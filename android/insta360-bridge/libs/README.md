# Official Insta360 Android SDK Placement Directory

This directory is designated for the official proprietary Insta360 Android SDK binaries.

## How to Obtain Official SDKs:
1. Register for an official developer account at https://www.insta360.com/developer
2. Submit an SDK application specifying:
   - Application Name: RenderWalk
   - Package ID: `com.renderwalk.camera.insta360`
   - Target Platforms: Android (minSdk 29, Android 10.0+)
   - Intended Capabilities: Camera Control (OSC/USB/BLE), Live RTSP Preview, Lossless Media Download, Multi-frame AEB bracketing
3. Once approved by Insta360 Developer Relations, download the release archives.
4. Place the resulting AAR libraries into this directory:
   - `libs/insta360-camera-sdk.aar` (Official Camera SDK)
   - `libs/insta360-media-sdk.aar`  (Official Media SDK)

## Current Status:
- Binaries not present in source repository.
- Native adapter cleanly reports: `INSTA360_SDK_NOT_AVAILABLE`.
- Zero mock hardware or fake SDK classes are compiled.
