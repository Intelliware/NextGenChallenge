# Mobile: start here

Build the app described in [REQUIREMENTS.md](REQUIREMENTS.md). Choose native iOS, native Android, or React Native/Expo. Your app starts from scratch in `mobile/solution/`.

## Get running

1. Install the tools for your chosen platform:
   - **iOS:** install [Xcode](https://developer.apple.com/xcode/) on a Mac. Open it, install the iOS platform when prompted, and create an iOS App project.
   - **Android:** install [Android Studio](https://developer.android.com/studio/install). Complete its setup wizard, create a project, and create an emulator in Device Manager.
   - **React Native/Expo:** follow [Expo's setup guide](https://docs.expo.dev/get-started/set-up-your-environment/) for your device. Use a development build when your chosen native features require it.
2. Save your project inside `mobile/solution/`. Launch the generated app on a simulator, emulator, or device before starting the tasks.
3. [Install Node.js and open a terminal in `NextGenChallenge`](../support/SETUP.md), then start the supplied API:

   ```sh
   node mobile/mock-server.mjs
   ```

4. On your computer, open <http://localhost:4001/health>. You should see `"status": "ok"`.
5. Set your app's API address using the table below. Fetch `/portfolios/P-9001` to get started.

## Connect your app

| Where the app runs | API address |
| --- | --- |
| iOS Simulator on the same Mac | `http://localhost:4001` |
| Android Studio emulator | `http://10.0.2.2:4001` |
| Physical phone | `http://YOUR-COMPUTER-IP:4001` |

For a phone, connect both devices to the same Wi-Fi and restart the mock with `node mobile/mock-server.mjs --host=0.0.0.0`. Find your computer's local IP in its network settings and replace `YOUR-COMPUTER-IP`. Allow the mock through your computer's firewall if prompted. Test `/health` in the phone's browser first.

These mocks use HTTP. If your app blocks local HTTP, use a development-only [Android network setting](https://developer.android.com/privacy-and-security/security-config) or [iOS local-network exception](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking). On iOS, also grant local-network access if prompted; see [Apple's local-network guidance](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy).

## Use the data

The [mock API guide](../support/PORTFOLIO-API.md) lists routes, field units, and datasets, including 60 holdings and short chart histories. The mock supplies data; you implement storage, secure access, offline behavior, navigation, sharing, and notifications.

- **Refresh:** `asOf` updates on every fetch. Change a scenario to test replacing the stored dataset.
- **Offline:** stop the mock or disconnect the device, then restore it. Check both a first launch and a launch with cached data. `?fail=true` simulates a failed request; it does not change the device's connectivity state.
- **Notifications:** [notification.json](fixtures/notification.json) targets the second portfolio. [notification-unknown.json](fixtures/notification-unknown.json) tests an unknown ID. Use these payloads with your own local notification mechanism. The API does not send push notifications.
- **Session token:** use any mock string, such as `superday-demo-token`, and protect it as described in Task 5. The supplied API does not require authentication.

Include your platform, run steps, tests, and assumptions with your solution.
