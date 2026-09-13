package clawperator.operator.debug;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;

/** Shell-only, debug-only fixture. Actual MediaPlayer progress is independent of its session report. */
public class MediaProofActivity extends Activity {
    static MediaSession session;
    static MediaSession second;
    static MediaPlayer player;
    static boolean publish = true;
    static String commandMode = "normal";
    static Context app;
    static final Handler handler = new Handler(android.os.Looper.getMainLooper());
    static long samples = 0;
    static long screenOnEvents = 0;
    static long screenOffEvents = 0;
    static void report() {
        if (player == null) return;
        if (publish) session.setPlaybackState(new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_SEEK_TO)
            .setState(player.isPlaying() ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                player.getCurrentPosition(), 1f, SystemClock.elapsedRealtime()).build());
        try {
            JSONObject data = new JSONObject().put("actualPositionMs", player.getCurrentPosition())
                .put("actualPlaying", player.isPlaying()).put("sampleCount", ++samples)
                .put("observedElapsedMs", SystemClock.elapsedRealtime())
                .put("screenOn", ((android.os.PowerManager) app.getSystemService(Context.POWER_SERVICE)).isInteractive())
                .put("deviceLocked", ((android.app.KeyguardManager) app.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked())
                .put("screenOnEvents", screenOnEvents).put("screenOffEvents", screenOffEvents);
            try (FileOutputStream out = app.openFileOutput("media-proof.json", Context.MODE_PRIVATE)) {
                out.write(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
        } catch (Exception error) { throw new IllegalStateException(error); }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        app = getApplicationContext();
        TextView text = new TextView(this);
        text.setText("Clawperator media proof: controlled real MediaPlayer progress");
        setContentView(text);
        if (player != null) return;
        android.content.IntentFilter powerFilter = new android.content.IntentFilter(Intent.ACTION_SCREEN_ON);
        powerFilter.addAction(Intent.ACTION_SCREEN_OFF);
        app.registerReceiver(new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) screenOnEvents++;
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) screenOffEvents++;
            }
        }, powerFilter);
        try {
            player = new MediaPlayer();
            player.setDataSource(new File(getFilesDir(), "media-proof.mp4").getPath());
            player.prepare();
            player.setLooping(true);
            player.setVolume(0, 0);
            player.setOnErrorListener((mp, what, extra) -> { android.util.Log.e("MediaProof", "player_error what=" + what + " extra=" + extra); return true; });
            session = new MediaSession(this, "notification-media-proof");
            session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
            session.setCallback(new MediaSession.Callback() {
                @Override public void onPlay() { player.start(); report(); }
                @Override public void onPause() {
                    if ("ignore".equals(commandMode)) return;
                    if ("replace".equals(commandMode)) { replaceSession(); return; }
                    player.pause(); report();
                }
                @Override public void onSeekTo(long position) { player.seekTo((int) position); report(); }
            });
            session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, "Controlled video fixture")
                .putLong(MediaMetadata.METADATA_KEY_DURATION, player.getDuration()).build());
            session.setActive(true);
            player.start();
            handler.post(new Runnable() {
                public void run() { report(); handler.postDelayed(this, 100); }
            });
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel("media-proof", "Media proof", NotificationManager.IMPORTANCE_LOW));
            Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "media-proof") : new Notification.Builder(this);
            manager.notify(8123, builder.setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("Controlled media proof")
                .setContentText("An ongoing notification visible to service reads").setOngoing(true).build());
        } catch (Exception error) { throw new IllegalStateException(error); }
    }
    static void replaceSession() {
        session.release();
        session = new MediaSession(app, "replacement-proof");
        session.setActive(true);
        report();
    }
    public static class Control extends BroadcastReceiver {
        @Override public void onReceive(Context context, Intent intent) {
            if (player == null) return;
            String operation = intent.getStringExtra("operation");
            if ("ignore".equals(operation) || "normal".equals(operation) || "replace-on-pause".equals(operation)) {
                commandMode = "replace-on-pause".equals(operation) ? "replace" : operation;
            }
            else if ("remove-second".equals(operation)) { if (second != null) second.release(); second = null; }
            else if ("stall".equals(operation)) { report(); publish = false; player.pause(); }
            else if ("unpublished-play".equals(operation)) { publish = false; player.start(); }
            else if ("resume".equals(operation)) { publish = true; player.start(); }
            else if ("second".equals(operation)) {
                second = new MediaSession(context, "second-proof"); second.setActive(true);
            } else if ("replace".equals(operation)) {
                replaceSession();
            }
            report();
        }
    }
}
