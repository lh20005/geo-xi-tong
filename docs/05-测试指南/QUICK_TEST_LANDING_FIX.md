# Landing Page "进入系统" Button Test Guide

## Current Status
✅ **Landing page deployed with correct configuration**
- Deployed at: 17:18 (Dec 27)
- Config version: 1.0.2-20251227-app-path-fix
- clientUrl: `http://${window.location.hostname}/app`

## Test Flow

### Step 1: Login on Server
1. Visit: http://43.143.163.6
2. Click "立即登录" button
3. Enter credentials:
   - Username: `lzc2005`
   - Password: `jehI2oBuNMMJehMM`
4. Click "登录" button
5. Should see "登录成功！正在跳转..."
6. Should redirect to home page

### Step 2: Verify Login State
After redirect, you should see:
- Username "lzc2005" in top right corner
- "进入系统" button (instead of "立即登录")

### Step 3: Click "进入系统"
1. Click the "进入系统" button
2. **Expected behavior:**
   - Browser should redirect to: `http://43.143.163.6/app/?token=xxx&refresh_token=xxx&user_info=xxx`
   - Client app should load
   - Tokens should be extracted from URL and saved to localStorage
   - URL should clean up to: `http://43.143.163.6/app/`
   - Dashboard should display

## Debugging Steps (If Button Doesn't Work)

### Check 1: Verify Login State
Open browser console (F12) and run:
```javascript
console.log('Token:', localStorage.getItem('auth_token'));
console.log('Refresh Token:', localStorage.getItem('refresh_token'));
console.log('User Info:', localStorage.getItem('user_info'));
```

All three should have values.

### Check 2: Verify Config
In browser console, check the config:
```javascript
// This should show the config object
console.log(window.location.hostname);
```

Should output: `43.143.163.6`

### Check 3: Test Button Click Manually
In browser console:
```javascript
const token = localStorage.getItem('auth_token');
const refreshToken = localStorage.getItem('refresh_token');
const userInfo = localStorage.getItem('user_info');

if (token && refreshToken && userInfo) {
  const params = new URLSearchParams({
    token,
    refresh_token: refreshToken,
    user_info: userInfo
  });
  const url = `http://${window.location.hostname}/app?${params.toString()}`;
  console.log('Redirect URL:', url);
  window.location.href = url;
}
```

This should manually trigger the redirect.

### Check 4: Verify Client App Token Extraction
After redirecting to `/app/`, open console and check:
```javascript
// Check if tokens were saved
console.log('Client Token:', localStorage.getItem('auth_token'));
console.log('Client Refresh Token:', localStorage.getItem('refresh_token'));
console.log('Client User Info:', localStorage.getItem('user_info'));
```

## Technical Details

### Landing Page Code
File: `landing/src/pages/HomePage.tsx`

```typescript
const handleEnterSystem = () => {
  if (isLoggedIn) {
    const token = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (token && refreshToken && userInfo) {
      const params = new URLSearchParams({
        token,
        refresh_token: refreshToken,
        user_info: userInfo
      });
      window.location.href = `${config.clientUrl}?${params.toString()}`;
    }
  }
};
```

### Client App Code
File: `client/src/App.tsx`

```typescript
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const refreshToken = params.get('refresh_token');
  const userInfo = params.get('user_info');

  if (token && refreshToken && userInfo) {
    console.log('[Client] 从 URL 参数接收到 token，保存到 localStorage');
    
    // 保存 token 到 localStorage
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_info', userInfo);
    
    // 清除 URL 参数，跳转到首页
    navigate('/', { replace: true });
  }
}, [location, navigate]);
```

## Verification Commands

### Check Backend Service
```bash
ssh ubuntu@43.143.163.6 "pm2 list"
```

### Check Landing Page Deployment
```bash
ssh ubuntu@43.143.163.6 "ls -lh /var/www/geo-system/landing/dist/assets/*.js"
```

### Check Client App Deployment
```bash
ssh ubuntu@43.143.163.6 "ls -lh /var/www/geo-system/client/dist/assets/*.js"
```

### Test Login API
```bash
curl -X POST http://43.143.163.6/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"lzc2005","password":"jehI2oBuNMMJehMM"}'
```

## Expected Result

✅ Complete flow should work:
1. Login on landing page → Success
2. Redirect to home page → Success
3. See "进入系统" button → Success
4. Click button → Redirect to `/app/` with tokens
5. Client app loads → Tokens saved
6. Dashboard displays → Success

## If Still Not Working

If the button still doesn't work after following all steps:

1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check browser console**: Look for any JavaScript errors
3. **Verify file timestamps**: Make sure latest files are deployed
4. **Test in incognito mode**: Rule out cache issues

## System Information

- **Server**: 43.143.163.6
- **Landing Page**: http://43.143.163.6
- **Client App**: http://43.143.163.6/app/
- **API**: http://43.143.163.6/api/
- **Admin User**: lzc2005
- **Admin Password**: jehI2oBuNMMJehMM

## Files Modified

1. `landing/src/config/env.ts` - Environment detection and clientUrl config
2. `landing/src/pages/HomePage.tsx` - handleEnterSystem function
3. `client/src/App.tsx` - Token extraction from URL params
4. `client/vite.config.ts` - Base path configuration

All files have been rebuilt and deployed to the server.
