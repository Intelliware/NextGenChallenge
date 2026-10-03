# Run a supplied mock

You need Node.js 24 or a newer supported LTS version to run the mocks. This does not limit the language you use for your solution.

1. Download the **LTS** installer for your computer from [nodejs.org](https://nodejs.org/en/download). Run it and accept the defaults. On Linux, follow the Linux instructions on that page.
2. Close and reopen your terminal (Terminal on macOS/Linux, PowerShell on Windows).
3. Check the installation:

   ```sh
   node --version
   ```

4. Open a terminal in the `NextGenChallenge` folder. In VS Code, open the folder, then choose **Terminal → New Terminal**. Otherwise, use `cd` followed by the folder's path.
5. Run the command in your track's setup guide. Leave that terminal open. Use a second terminal for your own app.

No `npm install`, database, Docker, API key, or paid account is needed for the supplied mocks. Stop a mock with **Ctrl+C**. Your own app may need other software or packages; follow your chosen framework's setup guide and record those steps with your solution.

## If something does not work

- **`node` is not recognized:** reopen the terminal after installing Node.js.
- **Cannot find module/file:** check that your terminal is in `NextGenChallenge`, not inside a track folder.
- **Port is busy:** stop the previous mock, or add `--port=4100` to its command. Use that port in your app too.
- **Cannot connect:** check that the mock terminal is still running, then open its `/health` URL in your browser.

The root `package.json` only contains shortcuts for the mocks and their tests. Install your app's packages inside your solution, using your own project configuration.
