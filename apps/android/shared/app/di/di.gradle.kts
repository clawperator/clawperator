plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "clawperator.di"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    
    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        buildConfig = true
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/kotlin")
        }
        getByName("test") {
            java.srcDirs("src/test/kotlin")
        }
    }
}

dependencies {
    implementation(project(":shared:app:app-adapter"))
    implementation(project(":shared:core:common"))
    implementation(project(":shared:core:devicepackage"))
    implementation(project(":shared:core:toolkit"))
    implementation(project(":shared:data:content"))
    implementation(project(":shared:data:content-model"))
    implementation(project(":shared:data:operator"))
    implementation(project(":shared:data:resources"))
    implementation(project(":shared:data:task"))
    implementation(project(":shared:data:toolkit"))
    implementation(project(":shared:data:trigger"))
    implementation(project(":shared:data:uitree"))
    implementation(project(":shared:data:workflow"))
    
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.koin.core)
    implementation(libs.koin.android)
    implementation(libs.ktor.client.core)
    implementation(libs.okhttp3.logging.interceptor)
    implementation(libs.okhttp3.okhttp)
    
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.koin.test)
    testImplementation(libs.robolectric)
    testImplementation(libs.kotlin.test)
}

// Disable quality checks for this module
tasks.withType<org.jlleitschuh.gradle.ktlint.tasks.BaseKtLintCheckTask>().configureEach {
    enabled = false
}
tasks.withType<com.diffplug.gradle.spotless.SpotlessTask>().configureEach {
    enabled = false
}
tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    enabled = false
}
tasks.withType<io.gitlab.arturbosch.detekt.DetektCreateBaselineTask>().configureEach {
    enabled = false
}
