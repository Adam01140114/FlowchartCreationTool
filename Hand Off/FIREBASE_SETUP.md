# Firebase Setup Instructions

## Why Firebase Save is Failing

The zoom sensitivity (and other user settings) cannot save to Firebase because the Firestore database has **default security rules** that deny all reads and writes. This is a security feature to prevent unauthorized access.

## Solution: Deploy Security Rules

I've created the necessary files to fix this:

- `firestore.rules` - Security rules that allow authenticated users to save their settings
- `firebase.json` - Firebase configuration file
- `firestore.indexes.json` - Firestore indexes configuration

## How to Deploy the Rules

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project** (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your existing project: `flowchart-1eb90`
   - Use the existing `firestore.rules` file
   - Use the existing `firestore.indexes.json` file

4. **Deploy the rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 2: Using Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `flowchart-1eb90`
3. Go to **Firestore Database** → **Rules** tab
4. Replace the existing rules with the content from `firestore.rules`
5. Click **Publish**

## What the Rules Allow

The security rules I created allow:

- ✅ **Authenticated users** to read/write their own `userSettings` (including zoom sensitivity)
- ✅ **Authenticated users** to read/write their own `flowcharts`
- ✅ **Authenticated users** to read/write their own `forms`
- ✅ **Public read access** to shared flowcharts (if marked as public)
- ❌ **Deny all other access** for security

## After Deployment

Once the rules are deployed, the zoom sensitivity setting will save to Firebase successfully, and you'll see:
```
🔧 [ZOOM SENSITIVITY] Successfully saved to Firebase
```

Instead of:
```
🔧 [ZOOM SENSITIVITY] Firebase permissions not available - settings saved locally only
```

## Security Note

These rules are secure because they:
- Only allow authenticated users to access data
- Users can only access their own data (based on `request.auth.uid`)
- All other access is explicitly denied
