#!/usr/bin/env bash

set -ex

rm -rf dist dist.zip
mkdir dist
yarn build
zip -j -9 -r dist.zip dist

fn="oulipo-lambda/dist-$(date +%s).zip"
export AWS_PAGER=""
aws s3 --region us-west-1 cp dist.zip "s3://lambda-mlc-us-west/$fn"
# aws lambda --region us-west-1 update-function-configuration --function-name 'arn:aws:lambda:us-west-1:859317109141:function:oulipofunc2' --runtime nodejs22.x
aws lambda --region us-west-1 update-function-code --function-name 'arn:aws:lambda:us-west-1:859317109141:function:oulipofunc2' --s3-bucket lambda-mlc-us-west --s3-key "$fn"
