import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Verze se bere z rozhraní (stremio-web/src/common/lumenVersion.js), aby byla všude stejná.
val webRoot = file(providers.gradleProperty("lumenWebRoot").getOrElse("../../stremio-web"))
val lumenVersion: String = run {
    val src = File(webRoot, "src/common/lumenVersion.js")
    Regex("LUMEN_VERSION:\\s*'([0-9.]+)'").find(if (src.exists()) src.readText() else "")?.groupValues?.get(1) ?: "0.0.0"
}
val lumenVersionCode: Int = lumenVersion.split(".").map { it.toIntOrNull() ?: 0 }
    .let { (it.getOrElse(0) { 0 } * 10000) + (it.getOrElse(1) { 0 } * 100) + it.getOrElse(2) { 0 } }

// Sestavené rozhraní (pnpm build) se přibalí do APK jako assets/web.
val webBuild = file(providers.gradleProperty("lumenWebBuild").getOrElse("${webRoot.path}/build"))
val webAssetsDir = layout.buildDirectory.dir("generated/lumenWeb")
val copyWeb by tasks.registering(Sync::class) {
    from(webBuild) {
        exclude("**/*.map", "service-worker.js", "workbox-*.js")
    }
    into(webAssetsDir.map { it.dir("web") })
}

// Podpis: android/keystore.properties (není v gitu) s storeFile, storePassword, keyAlias, keyPassword; jinak ladicí klíč.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "app.lumen.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.lumen.tv"
        minSdk = 24
        targetSdk = 35
        versionCode = lumenVersionCode
        versionName = lumenVersion
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    sourceSets["main"].assets.srcDir(webAssetsDir)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    androidResources {
        // wasm a velké skripty nekomprimovat zbytečně dvakrát; načítají se přes AssetManager
        noCompress += listOf("wasm")
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    val media3 = "1.8.0"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-exoplayer-dash:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    // zvuk, který televize sama neumí (DTS, TrueHD, E-AC3 na slabších TV): předpřipravený FFmpeg dekodér od Jellyfinu
    implementation("org.jellyfin.media3:media3-ffmpeg-decoder:$media3+1")
    implementation("androidx.webkit:webkit:1.14.0")
}
