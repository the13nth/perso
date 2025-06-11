#!/bin/bash

# Fix unused error variables
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/catch (error)/catch (_error)/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/catch (e)/catch (_e)/g'

# Fix unused imports by prefixing with _
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)google\([^}]*\) } from/import { \1_google\2 } from/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)getClient\([^}]*\) } from/import { \1_getClient\2 } from/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)OpenAIEmbeddings\([^}]*\) } from/import { \1_OpenAIEmbeddings\2 } from/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)ContentMetadata\([^}]*\) } from/import { \1_ContentMetadata\2 } from/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)convertToProcessedContent\([^}]*\) } from/import { \1_convertToProcessedContent\2 } from/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)extractPlainTextFromPayload\([^}]*\) } from/import { \1_extractPlainTextFromPayload\2 } from/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/import { \([^}]*\)refreshTokenIfNeeded\([^}]*\) } from/import { \1_refreshTokenIfNeeded\2 } from/g'

# Fix unused variables by prefixing with _
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/const handleError/const _handleError/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/const refreshTokenIfNeeded/const _refreshTokenIfNeeded/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/const extractPlainTextFromPayload/const _extractPlainTextFromPayload/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/const convertToProcessedContent/const _convertToProcessedContent/g' 