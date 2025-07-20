//CO2測定・通知送信用プログラム
import { Gpio } from 'pigpio';
import mqtt from 'mqtt';
//const { Gpio } = require('pigpio');

const pwmPin = new Gpio(18, { mode: Gpio.INPUT, alert: true });

let highTick = 0;
let danger = false;
let safeTimer=null;

//IP指定はここで
const mqttClient=mqtt.connect('mqtt://192.168.5.99:1883');
//送信先のトピック名
const topic='co2/status';

//MQTT接続成功時のログ
mqttClient.on('connect',()=>{
    console.log("MQTT接続成功");
});

// CO2データ処理
pwmPin.on('alert', (level, tick) => {
    //パルス幅の計測
  if (level === 1) {
    highTick = tick;
  } else {
    const diff = (tick >>> 0) - (highTick >>> 0);
    const durationMs = diff / 1000;
    const co2ppm = Math.round((durationMs - 2) * 5000 / 1000);
    const timestamp = new Date().toISOString();
    let message = `[${timestamp}] CO₂濃度: ${co2ppm} ppm`;

    if (co2ppm > 1000) {
      if (!danger) {
        danger = true;
        console.log("危険状態（CO₂ > 1000ppm）→ MQTT送信");
        // mqttClient.publish(topic, JSON.stringify({
        // //   timestamp,
        // //   co2ppm,
        //   status: 'danger'
        // }));
        mqttClient.publish(topic,'danger');
      }
      //安全タイマーをキャンセル
      if(safeTimer){
          clearTimeout(safeTimer);
          safeTimer=null;
          console.log("危険域に戻りました　安全送信タイマーをキャンセルします")
      }

      message += " ←危険！";
    } else {
      if (danger && !safeTimer) {
          //デモ用に10秒後に変更済み
        console.log("安全状態に復帰 → 10秒後にMQTT送信");
        safeTimer=setTimeout(() => {
            const newTimestamp=new Date().toISOString();
            // mqttClient.publish(topic,JSON.stringify({
            //     // timestamp: newTimestamp,
            //     // co2ppm,
            //     status: 'safe'
            // }));
            mqttClient.publish(topic,'safe');
            console.log("安全状態を送信　ドアが閉まります");
            danger=false;
            safeTimer=null;
        },/*0.5*60*/10*1000);
      }
    }

    console.log(message);
  }
});

// 終了処理
process.on('SIGINT', () => {
  pwmPin.disableAlert();
  mqttClient.end();
  if(safeTimer){
      cleanTimeout(safeTimer);
  }
  console.log("\n測定終了・MQTT切断");
  process.exit();
});