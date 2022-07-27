terraform {
  required_version = "1.2.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.23.0"
    }
  }

  backend "s3" {
    bucket         = "ecm85-terraform"
    key            = "birthday-video"
    region         = "us-east-2"
    dynamodb_table = "tfstate-lock"
  }
}

provider "aws" {
  region = "us-east-2"
}

resource "aws_s3_bucket" "website" {
  bucket = "birthday-video"
}

resource "aws_s3_bucket_acl" "website" {
  bucket = aws_s3_bucket.website.bucket
  acl    = "private"
}

data "aws_iam_policy_document" "website" {
  statement {
    principals {
      type        = "*"
      identifiers = ["*"]
    }

    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.website.json
}

resource "aws_s3_bucket_website_configuration" "example" {
  bucket = aws_s3_bucket.website.bucket

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

locals {
  default_content_type = "application/octet-stream"
  file_extension_to_content_type = {
    "png"  = "image/png"
    "css"  = "text/css"
    "js"   = "text/javascript"
    "html" = "text/html"
  }
  bucket_source = "${path.module}/build"
  bucket_pass1 = [for local_path in fileset(local.bucket_source, "**") : {
    full_path      = "${local.bucket_source}/${local_path}"
    local_path     = local_path
    file_extension = element(concat(reverse(split(".", local_path)), [""]), 0)
  }]
  bucket_files = { for item in local.bucket_pass1 : item.local_path => {
    full_path    = item.full_path
    content_type = lookup(local.file_extension_to_content_type, item.file_extension, local.default_content_type)
  } }
}

resource "aws_s3_object" "files" {
  for_each = local.bucket_files

  bucket = aws_s3_bucket.website.bucket
  key    = each.key
  source = each.value.full_path

  etag = filemd5(each.value.full_path)

  content_type = each.value.content_type
}

locals {
  s3_origin_id = "myS3Origin"
}

resource "aws_cloudfront_distribution" "s3_distribution" {
  origin {
    domain_name = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id   = local.s3_origin_id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = ["birthday-video.stormtide.net"]

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "allow-all"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # Cache behavior with precedence 0
  ordered_cache_behavior {
    path_pattern     = "/content/immutable/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # Cache behavior with precedence 1
  ordered_cache_behavior {
    path_pattern     = "/content/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = "arn:aws:acm:us-east-1:854713338508:certificate/69701efd-b6ed-4912-88c6-e6ec338a6c8b"
    ssl_support_method = "sni-only"
  }
}
