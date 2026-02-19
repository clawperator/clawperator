plugins {
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "clawperator.uitree"
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
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.composeCompiler.get()
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/kotlin")
        }
    }
}

dependencies {
    implementation(project(":shared:core:common"))
    api(project(":shared:core:toolkit"))
    api(project(":shared:data:content-model"))
    implementation(project(":shared:data:resources"))
    implementation(project(":shared:data:toolkit"))
    
    implementation(libs.kotlinx.serialization.json)
    api(libs.ktor.client.core)
    implementation(libs.ktor.client.logging)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    
    implementation(libs.androidx.core)
    implementation(libs.compose.material)
    implementation(libs.compose.runtime)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.koin.android)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.okhttp3.okhttp)
    implementation(libs.process.phoenix)
    implementation(libs.timber)
}
