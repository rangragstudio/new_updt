plugins {
    id("com.android.library") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}

// ============================================================================
// RenderWalk Android Native Camera Bridge Module for Official Insta360 SDK
// ============================================================================
//
// OFFICIAL INSTA360 SDK ACQUISITION REQUIREMENT:
// ----------------------------------------------
// The official Insta360 Android SDK (Camera SDK & Media SDK) is proprietary and
// must be obtained directly through the official Insta360 Developer Portal:
// https://www.insta360.com/developer
//
// Once approved and downloaded from Insta360, place the official AAR packages
// into the android/insta360-bridge/libs/ directory:
// 1. libs/insta360-camera-sdk.aar (Official Camera SDK)
// 2. libs/insta360-media-sdk.aar  (Official Media SDK)
//
// ANDROID SYSTEM REQUIREMENTS:
// ----------------------------
// - Android 10.0 (API Level 29) minimum required by official Insta360 SDK.
// - compileSdk / targetSdk: 34 (Android 14)
// ============================================================================

android {
    namespace = "com.renderwalk.camera.insta360"
    compileSdk = 34

    defaultConfig {
        minSdk = 29 // Android 10.0 required by official Insta360 SDK
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Official Insta360 SDK AAR placement directory
    implementation(fileTree(mapOf("dir" to "libs", "include" to listOf("*.aar", "*.jar"))))

    // Core AndroidX support without third-party camera libraries
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.annotation:annotation:1.7.1")
}
