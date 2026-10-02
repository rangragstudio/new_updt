plugins {
    id("com.android.library") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}

// RenderWalk Android Native Camera Bridge Module for Insta360
// Decouples web/React layer from native camera SDK binaries.
// If Insta360 CameraSDK AAR is dropped into libs/, it is linked here.
