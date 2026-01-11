#!/bin/bash
echo "=== 本地有但服务器没有的列 ==="
comm -23 /tmp/local_cols_final.txt temp/server_cols_final.txt

echo ""
echo "=== 服务器有但本地没有的列 ==="
comm -13 /tmp/local_cols_final.txt temp/server_cols_final.txt
