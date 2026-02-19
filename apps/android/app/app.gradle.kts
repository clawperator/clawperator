plugins {
    id("com.android.application")
    id("kotlin-android")
    alias(libs.plugins.kotlin.serialization)
}

val getVersionCode: (Int, Int, Int, Int) -> Int = { major, minor, patch, build ->
    major * 10000000 + minor * 100000 + patch * 1000 + build * 10 + 1
}

val getVersionName: (Int, Int, String?, Int?) -> String = { major, minor, type, versionCode ->
    var versionName = "$major.$minor"
    if (type != null) {
        versionName = "$versionName-$type"
    }
    if (versionCode != null) {
        versionName = "$versionName-($versionCode)"
    }
    versionName
}

android {
    namespace = "com.clawperator.operator"

    val versionMajor = 1
    val versionMinor = 0
    val versionPatch = 0
    val versionBuild = 0

    defaultConfig {
        applicationId = "com.clawperator.operator"
        versionCode = getVersionCode(versionMajor, versionMinor, versionPatch, versionBuild)
        versionName = getVersionName(versionMajor, versionMinor, "DEMO", null)
    }

    signingConfigs {
        getByName("debug") {
            storeFile = file("../../../.android/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("release") {
            // Fall back to using debug keystore if environment variables are not set. Required for CI.
            storeFile = System.getenv("KEYSTORE_LOCATION")?.let { file(it) } ?: file("../../../scripts/debug.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "android"
            keyAlias = System.getenv("ACTION_LAUNCHER_KEY_ALIAS") ?: "androiddebugkey"
            keyPassword = System.getenv("ACTION_LAUNCHER_KEY_PASSWORD") ?: "android"

            isV1SigningEnabled = true
            isV2SigningEnabled = true
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-d"
        }

        release {
            signingConfig = signingConfigs.getByName("release")

            applicationIdSuffix = ""

            isShrinkResources = true
            isDebuggable = false
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }

    lint {
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation(libs.kotlin.stdlib.jdk8)

    implementation(libs.koin.android)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.okhttp3.logging.interceptor)
    implementation(libs.okhttp3.okhttp)
    implementation(libs.timber)

    implementation(project(":shared:app:app-adapter"))
    implementation(project(":shared:core:common"))
    implementation(project(":shared:data:operator"))
    
//    implementation(project(":shared:system:device-package"))

    implementation(project(":shared:app:di"))

    testImplementation(libs.koin.test)
    testImplementation(libs.androidx.arch.core.testing)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.robolectric)
    testImplementation(libs.kotlin.reflect)
    testImplementation(libs.kotlin.test)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.androidx.test.espresso.contrib)
    androidTestImplementation(libs.androidx.test.espresso.intents)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.arch.core.testing)
    androidTestImplementation(libs.kotlin.test)
}

project.afterEvaluate {
    android.applicationVariants.forEach { variant ->
        val variantCap = variant.name.replaceFirstChar { it.titlecase() }
        val pkg = variant.applicationId

        if (variant.buildType.name == "debug") {
            tasks.register<Exec>("run$variantCap") {
                dependsOn("install$variantCap")
                group = "run"
                commandLine("adb", "shell", "am", "start", "-n", "${variant.applicationId}/clawperator.activity.MainActivity")
                doLast {
                    println("Launching ${variant.applicationId}/clawperator.activity.MainActivity")

                    println("⏱️  Waiting 2 seconds for installation to complete...")
                    Thread.sleep(2000)

                    println("🔧 Granting permissions for $pkg...")
                    exec {
                        commandLine("${project.rootDir}/../../scripts/clawperator_grant_android_permissions.sh", "--package", pkg)
                    }
                }
            }
        }
    }
}

apply(plugin = "com.google.gms.google-services")
apply(plugin = "com.google.firebase.crashlytics")
