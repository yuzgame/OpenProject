//センサーとドアノブ用モーターをGPIO通信で実行する（プロトタイプ）
//const { Gpio } = require('pigpio');
import { Gpio } from 'pigpio';
const pwmPin = new Gpio(18, { mode: Gpio.INPUT, alert: true });
const motorIn1 = new Gpio(17, { mode: Gpio.OUTPUT });
const motorIn2 = new Gpio(27, { mode: Gpio.OUTPUT });

let highTick = 0;
let danger = false;
let reverseTimer = null;
/*
// モーター正転
function rotateForward(durationMs = 5000) {
  console.log("⚙️ モーター正転（5秒）");
  motorIn1.digitalWrite(1);
  motorIn2.digitalWrite(0);
  setTimeout(() => {
    motorIn1.digitalWrite(0);
    motorIn2.digitalWrite(0);
    console.log("✅ モーター停止（正転後）");
  }, durationMs);
}

// モーター逆転
function rotateBackward(durationMs = 5000) {
  console.log("🔁 モーター逆転（5秒）");
  motorIn1.digitalWrite(0);
  motorIn2.digitalWrite(1);
  setTimeout(() => {
    motorIn1.digitalWrite(0);
    motorIn2.digitalWrite(0);
    console.log("✅ モーター停止（逆転後）");
  }, durationMs);
}
*/

// モーター正転→1秒→逆転
function forwardThenReverse() {
  console.log("⚙️ モーター正転（5秒）");
  motorIn1.digitalWrite(1);
  motorIn2.digitalWrite(0);
  setTimeout(() => {
    stopMotor();
    console.log("⏸️ 1秒待機中...");
    setTimeout(() => {
      console.log("🔁 モーター逆転（5秒）");
      motorIn1.digitalWrite(0);
      motorIn2.digitalWrite(1);
      setTimeout(() => {
        stopMotor();
        console.log("✅ モーター停止（逆転後）");
      }, 5000);
    }, 1000);
  }, 5000);
}

//モーター停止
function stopMotor(){
    motorIn1.digitalWrite(0);
    motorIn2.digitalWrite(0);
}

pwmPin.on('alert', (level, tick) => {
  if (level === 1) {
    highTick = tick;
  } else {
    const diff = (tick >>> 0) - (highTick >>> 0);
    const durationMs = diff / 1000;
    const co2ppm = Math.round((durationMs - 2) * 5000 / 1000);
    const timestamp = new Date().toISOString();
    let message = `[${timestamp}] CO2濃度: ${co2ppm} ppm`;

    if (co2ppm > 1000) {
      if (!danger) {
        danger = true;
        console.log("⚠️ 警告状態に移行：CO₂ > 1000ppm");
        //rotateForward(); // 正転モーター起動
        //待ち時間1秒
        //rotateBackward(); //   逆転モーター軌道
        forwardThenReverse();
      }
      message += " ←危険！";

      // 逆転用タイマーをキャンセル（もしあれば）
      if (reverseTimer) {
        clearTimeout(reverseTimer);
        reverseTimer = null;
        console.log("🛑 タイマーをキャンセル");
      }

    } else {
      if (danger && !reverseTimer) {
        console.log("😌 CO₂が正常域に戻りました。1分後に閉じる予定...");
        reverseTimer = setTimeout(() => {
          console.log("⏱️ 1分経過、閉じます");
          //rotateForward();
          //待ち時間1秒
          //rotateBackward();
          forwardThenReverse();
          danger = false;
          reverseTimer = null;
        }, 1 * 60 * 1000); // 1分
      }
    }

    console.log(message);
  }
});

process.on('SIGINT', () => {
  pwmPin.disableAlert();
  motorIn1.digitalWrite(0);
  motorIn2.digitalWrite(0);
  console.log("\n🛑 測定終了・モーター停止");
  process.exit();
});