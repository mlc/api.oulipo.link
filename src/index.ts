import 'source-map-support/register';

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { URL } from 'url';
import secureRandomNumber from './random-number-csprng';

const bucket = process.env['OULIPO_BUCKET'];
const region = process.env['OULIPO_REGION'];
const prefix = process.env['OULIPO_PREFIX'];
const cdn_prefix = process.env['OULIPO_CDN_PREFIX'];

const chars = 'abcdfghjijklmnopqrstuvwxyzABCDFGHIJKLMNOPQRSTUVWXYZ0123456789';

const randomChar = async (): Promise<string> =>
  chars[await secureRandomNumber(0, chars.length - 1)];

const generate = (): Promise<string> =>
  Promise.all(new Array(6).fill(0).map(randomChar)).then((chars) =>
    chars.join('')
  );

const s3 = new S3Client({ region });

const responseHeaders = {
  'content-type': 'application/json',
  'cache-control': 'private,no-cache',
};

const errorResponse = (error: string): APIGatewayProxyResultV2 => ({
  statusCode: 400,
  body: JSON.stringify({ error }),
  headers: responseHeaders,
});

const successResponse = (
  url_long: string,
  url_short: string
): APIGatewayProxyResultV2 => ({
  statusCode: 200,
  body: JSON.stringify({ url_long: url_long, url_short: url_short }),
  headers: responseHeaders,
});

const objectExists = (Key: string): Promise<boolean> =>
  s3.send(new HeadObjectCommand({ Bucket: bucket, Key })).then(
    () => true,
    (err) => {
      if ('name' in err && err.name === 'NotFound') {
        return false;
      } else {
        return Promise.reject(err);
      }
    }
  );

const validUrl = (url: any): boolean => {
  if (typeof url !== 'string') {
    return false;
  }
  try {
    const url_check = new URL(url);
    return !!(
      url_check &&
      url_check.host &&
      ['https:', 'http:'].indexOf(url_check.protocol) >= 0
    );
  } catch {
    return false;
  }
};

const checkAndCreateRedirect = async (url_long: string): Promise<string> => {
  let retry = 0;
  do {
    retry += 1;
    const id_short = await generate();
    const key_short = prefix + '/' + id_short;
    if (await objectExists(key_short)) {
      continue;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key_short,
        Body: '',
        WebsiteRedirectLocation: url_long,
        ContentType: 'text/plain',
        CacheControl: 'public, max-age=315576000',
      })
    );
    const ret_url = 'https://' + cdn_prefix + '/' + id_short;
    console.log('Okay! short_url = ' + ret_url);
    return ret_url;
  } while (retry <= 3);
  throw new Error('Cannot find a good short id, aborting.');
};

export const handler: AWSLambda.APIGatewayProxyHandlerV2 = async (event) => {
  const { cdn_prefix: input_cdn_prefix, url_long } = JSON.parse(
    event.body ?? ''
  );

  if (input_cdn_prefix !== cdn_prefix) {
    return errorResponse('Invalid CDN location');
  }

  if (!validUrl(url_long)) {
    return errorResponse('Missing or invalid URL format');
  }

  console.log('shrinking ' + url_long);
  try {
    const url_short = await checkAndCreateRedirect(url_long);
    return successResponse(url_long, url_short);
  } catch (e) {
    console.error(e);
    let message: string;
    if (typeof e === 'string') {
      message = e;
    } else if ('message' in e && typeof e.message === 'string') {
      message = e.message;
    } else {
      message = "It didn't work.";
    }
    return errorResponse(message);
  }
};
