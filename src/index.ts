import sourceMapSupport from 'source-map-support';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { URL } from 'node:url';
import { randomInt } from 'node:crypto';

sourceMapSupport.install();

const bucket = process.env['OULIPO_BUCKET'];
const region = process.env['OULIPO_REGION'];
const prefix = process.env['OULIPO_PREFIX'];
const cdn_prefix = process.env['OULIPO_CDN_PREFIX'];

const chars = 'abcdfghjijklmnopqrstuvwxyzABCDFGHIJKLMNOPQRSTUVWXYZ0123456789';

const randomChar = (): string => chars[randomInt(chars.length)];

const generate = (): string => new Array(6).fill(0).map(randomChar).join('');

const s3 = new S3Client({ region });

const responseHeaders = {
  'content-type': 'application/json',
  'cache-control': 'private,no-cache',
};

const errorResponse = (
  error: string,
  statusCode = 200
): APIGatewayProxyResultV2 => ({
  statusCode,
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
    (err: Error) => {
      if ('name' in err && err.name === 'NotFound') {
        return false;
      } else {
        return Promise.reject(err);
      }
    }
  );

const validUrl = (url: any): url is string => {
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
    const id_short = generate();
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

interface Input {
  cdn_prefix?: string;
  url_long?: string;
}

const parseInput = (body: string | undefined): Input | undefined => {
  if (typeof body !== 'string' || body === '') {
    console.error('no body');
    return undefined;
  }
  try {
    const result = JSON.parse(body);
    if (typeof result !== 'object' || Array.isArray(result)) {
      console.error('bad kind of body');
      return undefined;
    }
    return result;
  } catch (e) {
    console.error(e);
    return undefined;
  }
};

export const handler: AWSLambda.APIGatewayProxyHandlerV2 = async (event) => {
  const input = parseInput(event.body);
  if (input === undefined) {
    return errorResponse('Bad input', 400);
  }
  const { cdn_prefix: input_cdn_prefix, url_long } = input;

  if (input_cdn_prefix !== cdn_prefix) {
    return errorResponse('Invalid CDN location');
  }

  if (!validUrl(url_long)) {
    return errorResponse('Missing or invalid URL format');
  }

  console.log(`shrinking ${url_long}`);
  try {
    const url_short = await checkAndCreateRedirect(url_long);
    return successResponse(url_long, url_short);
  } catch (e) {
    console.error(e);
    let message: string;
    if (typeof e === 'string') {
      message = e;
    } else if (e instanceof Error) {
      message = e.message;
    } else {
      message = "It didn't work.";
    }
    return errorResponse(message);
  }
};
