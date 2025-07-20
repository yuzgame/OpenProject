//two_motor.js　通知受ける、モータAB連携側スクリプト
import mqtt from "mqtt";
import { requestGPIOAccess } from "node-web-gpio";
import PCA9685 from "@chirimen/pca9685";
import { requestI2CAccess } from "node-web-i2c";

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

// モータA（MX1508）制御用
const motorPorts = [20, 21];
let ports;

// モータB（PCA9685）制御用
let pwm;

async function setupMotors() {
  // GPIO初期化
  const gpioAccess = await requestGPIOAccess();
  ports = [];
  for (let i = 0; i < 2; i++) {
    ports[i] = gpioAccess.ports.get(motorPorts[i]);
    await ports[i].export("out");
    await ports[i].write(0);
  }

  // I2C初期化（PCA9685）
  const i2cAccess = await requestI2CAccess();
  const port = i2cAccess.ports.get(1);
  pwm = new PCA9685(port, 0x40);
  await pwm.init(0.0006, 0.0023, 60); // サーボ設定
}

async function fwd() {
  await ports[0].write(1);
  await ports[1].write(0);
}
async function rev() {
  await ports[0].write(0);
  await ports[1].write(1);
}
async function brake() {
  await ports[0].write(1);
  await ports[1].write(1);
  await sleep(300);
  await ports[0].write(0);
  await ports[1].write(0);
}

async function setServo(deg) {
  await pwm.setServo(0, deg); // 0番ピンに接続したSG90を指定角に
}

// 開ける処理：モータA順転→B+90度→A逆転
async function openSequence() {
  console.log("Opening...");
  await fwd();
  await sleep(800);
  await brake();
  await sleep(5000)
  await setServo(60); // +90度相当
  await sleep(1000);

  await rev();
  await sleep(800);
  await brake();
}

// 閉める処理：モータB -90度回転のみ
async function closeSequence() {
  console.log("Closing...");
  await setServo(-60); // -90度相当
  await sleep(1000);
}

async function main() {
    console.log("start!!");
    await setupMotors();

  // MQTT接続（ラズパイAのIPに応じて変更）
  const client = mqtt.connect("mqtt://localhost");

  client.on("connect", () => {
    console.log("MQTT connected");
    client.subscribe("co2/status");
  });

  client.on("message", async (topic, message) => {
    const cmd = message.toString();
    console.log("Received:", cmd);

    if (cmd === "danger") {
      console.log("danger!!");
      await openSequence();
    } else if (cmd === "safe") {
      console.log("safe!!");
      await closeSequence();
    }
  });
    // await openSequence();
    // await sleep(5000);
    // await closeSequence();
}

main();