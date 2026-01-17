#!/bin/bash

# UUID 类型修复脚本
# 将 reservationId 和 snapshotId 从 string 改为 number

echo "🔧 开始修复 UUID 类型..."

# 修复 preload.ts
echo "📝 修复 electron/preload.ts..."
sed -i '' 's/confirmQuota: (reservationId: string/confirmQuota: (reservationId: number/g' electron/preload.ts
sed -i '' 's/releaseQuota: (reservationId: string/releaseQuota: (reservationId: number/g' electron/preload.ts
sed -i '' 's/restore: (snapshotId: string/restore: (snapshotId: number/g' electron/preload.ts
sed -i '' 's/deleteSnapshot: (snapshotId: string/deleteSnapshot: (snapshotId: number/g' electron/preload.ts

# 修复 electron.d.ts
echo "📝 修复 src/types/electron.d.ts..."
sed -i '' 's/confirmQuota: (reservationId: string/confirmQuota: (reservationId: number/g' src/types/electron.d.ts
sed -i '' 's/releaseQuota: (reservationId: string/releaseQuota: (reservationId: number/g' src/types/electron.d.ts
sed -i '' 's/restore: (snapshotId: string/restore: (snapshotId: number/g' src/types/electron.d.ts
sed -i '' 's/deleteSnapshot: (snapshotId: string/deleteSnapshot: (snapshotId: number/g' src/types/electron.d.ts

# 修复 src/api/local.ts
echo "📝 修复 src/api/local.ts..."
sed -i '' 's/confirmQuota: async (reservationId: string/confirmQuota: async (reservationId: number/g' src/api/local.ts
sed -i '' 's/releaseQuota: async (reservationId: string/releaseQuota: async (reservationId: number/g' src/api/local.ts
sed -i '' 's/restore: async (snapshotId: string/restore: async (snapshotId: number/g' src/api/local.ts
sed -i '' 's/deleteSnapshot: async (snapshotId: string/deleteSnapshot: async (snapshotId: number/g' src/api/local.ts

# 修复 src/api/remote.ts
echo "📝 修复 src/api/remote.ts..."
sed -i '' 's/reservationId: string/reservationId: number/g' src/api/remote.ts
sed -i '' 's/confirm: async (reservationId: string/confirm: async (reservationId: number/g' src/api/remote.ts
sed -i '' 's/release: async (reservationId: string/release: async (reservationId: number/g' src/api/remote.ts
sed -i '' 's/download: async (snapshotId: string/download: async (snapshotId: number/g' src/api/remote.ts
sed -i '' 's/deleteSnapshot: async (snapshotId: string/deleteSnapshot: async (snapshotId: number/g' src/api/remote.ts

# 修复 src/stores/syncStore.ts
echo "📝 修复 src/stores/syncStore.ts..."
sed -i '' 's/snapshotId?: string/snapshotId?: number/g' src/stores/syncStore.ts
sed -i '' 's/restore: (snapshotId: string/restore: (snapshotId: number/g' src/stores/syncStore.ts
sed -i '' 's/deleteSnapshot: (snapshotId: string/deleteSnapshot: (snapshotId: number/g' src/stores/syncStore.ts

echo "✅ UUID 类型修复完成！"
echo ""
echo "📋 已修复的文件："
echo "  - electron/preload.ts"
echo "  - src/types/electron.d.ts"
echo "  - src/api/local.ts"
echo "  - src/api/remote.ts"
echo "  - src/stores/syncStore.ts"
echo ""
echo "🔍 请运行以下命令验证："
echo "  npm run build"
