plugins {
    id("com.android.application")
    id("kotlin-android")
    alias(libs.plugins.kotlin.serialization)
}

fun env(name: String, legacyName: String? = null): String? =
    System.getenv(name) ?: legacyName?.let(System::getenv)

data class ParsedVersion(
    val name: String,
    val major: Int,
    val minor: Int,
    val patch: Int,
    val prereleaseLabel: String?,
    val prereleaseNumber: Int?
)

fun parseVersionName(versionName: String): ParsedVersion {
    val match = Regex("""^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+)(?:\.(\d+))?)?$""")
        .matchEntire(versionName)
        ?: throw GradleException("Unsupported Clawperator version format: $versionName")

    return ParsedVersion(
        name = versionName,
        major = match.groupValues[1].toInt(),
        minor = match.groupValues[2].toInt(),
        patch = match.groupValues[3].toInt(),
        prereleaseLabel = match.groupValues[4].ifBlank { null }?.lowercase(),
        prereleaseNumber = match.groupValues[5].ifBlank { null }?.toInt()
    )
}

fun computeVersionCode(version: ParsedVersion): Int {
    val prereleaseNumber = version.prereleaseNumber ?: 0
    if (prereleaseNumber > 99) {
        throw GradleException("Prerelease number must be between 0 and 99: ${version.name}")
    }

    val prereleaseOffset = when (version.prereleaseLabel) {
        null -> 900
        "rc" -> 800 + prereleaseNumber
        "beta" -> 500 + prereleaseNumber
        "alpha" -> 200 + prereleaseNumber
        else -> 100 + prereleaseNumber
    }

    return version.major * 10000000 +
        version.minor * 100000 +
        version.patch * 1000 +
        prereleaseOffset
}

fun readNodePackageVersion(): String {
    val packageJson = rootProject.file("apps/node/package.json")
    val versionLine = Regex(""""version"\s*:\s*"([^"]+)"""")
        .find(packageJson.readText())
        ?.groupValues
        ?.get(1)
        ?: throw GradleException("Unable to read version from ${packageJson.path}")

    return versionLine
}

android {
    namespace = "com.clawperator.operator"

    val resolvedVersionName = System.getenv("CLAWPERATOR_VERSION_NAME") ?: readNodePackageVersion()
    val resolvedVersion = parseVersionName(resolvedVersionName)

    defaultConfig {
        applicationId = "com.clawperator.operator"
        versionCode = System.getenv("CLAWPERATOR_VERSION_CODE")?.toInt() ?: computeVersionCode(resolvedVersion)
        versionName = resolvedVersion.name
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
            storeFile = env("CLAWPERATOR_ANDROID_KEYSTORE_PATH")?.let { file(it) }
                ?: env("ANDROID_KEYSTORE_PATH", "KEYSTORE_LOCATION")?.let { file(it) }
                ?: file("../../../scripts/debug.keystore")
            storePassword = env("CLAWPERATOR_ANDROID_KEYSTORE_PASSWORD")
                ?: env("ANDROID_KEYSTORE_PASSWORD", "KEYSTORE_PASSWORD")
                ?: "android"
            keyAlias = env("CLAWPERATOR_ANDROID_KEY_ALIAS")
                ?: env("ANDROID_KEY_ALIAS", "ACTION_LAUNCHER_KEY_ALIAS")
                ?: "androiddebugkey"
            keyPassword = env("CLAWPERATOR_ANDROID_KEY_PASSWORD")
                ?: env("ANDROID_KEY_PASSWORD", "ACTION_LAUNCHER_KEY_PASSWORD")
                ?: "android"

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
