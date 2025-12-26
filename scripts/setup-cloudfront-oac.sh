#!/bin/bash

# CloudFront + OAC 설정 스크립트
# 사용법: ./setup-cloudfront-oac.sh <BUCKET_NAME> <REGION> <ACCOUNT_ID>

set -e

BUCKET_NAME=$1
REGION=$2
ACCOUNT_ID=$3

if [ -z "$BUCKET_NAME" ] || [ -z "$REGION" ] || [ -z "$ACCOUNT_ID" ]; then
    echo "사용법: $0 <BUCKET_NAME> <REGION> <ACCOUNT_ID>"
    echo "예시: $0 my-bucket ap-northeast-2 123456789012"
    exit 1
fi

echo "🚀 CloudFront + OAC 설정을 시작합니다..."
echo "버킷: $BUCKET_NAME"
echo "리전: $REGION"
echo "계정 ID: $ACCOUNT_ID"
echo ""

# 1. S3 버킷 퍼블릭 액세스 차단
echo "1️⃣ S3 버킷 퍼블릭 액세스 차단 설정 중..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "✅ 퍼블릭 액세스 차단 완료"
echo ""

# 2. OAC 생성
echo "2️⃣ Origin Access Control (OAC) 생성 중..."
OAC_OUTPUT=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config \
    "Name=${BUCKET_NAME}-oac,OriginAccessControlOriginType=s3,SigningBehavior=always,SigningProtocol=sigv4" \
    --output json)

OAC_ID=$(echo "$OAC_OUTPUT" | jq -r '.OriginAccessControl.Id')
OAC_ARN=$(echo "$OAC_OUTPUT" | jq -r '.OriginAccessControl.OriginAccessControlConfig.OriginAccessControlOriginType')

echo "✅ OAC 생성 완료: $OAC_ID"
echo ""

# 3. CloudFront 배포 생성 (기본 설정)
echo "3️⃣ CloudFront 배포 생성 중..."
ORIGIN_DOMAIN="${BUCKET_NAME}.s3.${REGION}.amazonaws.com"

# 배포 설정 JSON 생성
cat > /tmp/cloudfront-config.json <<EOF
{
    "CallerReference": "$(date +%s)",
    "Comment": "S3 OAC 배포 for ${BUCKET_NAME}",
    "DefaultCacheBehavior": {
        "TargetOriginId": "${BUCKET_NAME}-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"]
            }
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true
    },
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "${BUCKET_NAME}-origin",
                "DomainName": "${ORIGIN_DOMAIN}",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                },
                "OriginAccessControlId": "${OAC_ID}"
            }
        ]
    },
    "Enabled": true,
    "PriceClass": "PriceClass_All"
}
EOF

DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution \
    --distribution-config file:///tmp/cloudfront-config.json \
    --output json)

DISTRIBUTION_ID=$(echo "$DISTRIBUTION_OUTPUT" | jq -r '.Distribution.Id')
DISTRIBUTION_DOMAIN=$(echo "$DISTRIBUTION_OUTPUT" | jq -r '.Distribution.DomainName')

echo "✅ CloudFront 배포 생성 완료"
echo "   배포 ID: $DISTRIBUTION_ID"
echo "   도메인: $DISTRIBUTION_DOMAIN"
echo ""

# 4. S3 버킷 정책 업데이트
echo "4️⃣ S3 버킷 정책 업데이트 중..."
cat > /tmp/bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
                }
            }
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy file:///tmp/bucket-policy.json

echo "✅ 버킷 정책 업데이트 완료"
echo ""

# 5. 정리
rm -f /tmp/cloudfront-config.json /tmp/bucket-policy.json

echo "🎉 설정 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. CloudFront 배포가 완료될 때까지 대기 (5-15분)"
echo "2. .env 파일에 다음 추가:"
echo "   S3_PUBLIC_BASE_URL=https://${DISTRIBUTION_DOMAIN}"
echo ""
echo "3. 배포 상태 확인:"
echo "   aws cloudfront get-distribution --id ${DISTRIBUTION_ID}"
echo ""

