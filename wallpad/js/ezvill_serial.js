/**
 * RS485 Homegateway for Commax
 * @소스 공개 : Daehwan, Kang
 * @삼성 홈넷용으로 수정 : erita
 * @수정일 2019-01-11
 * @코맥스 홈넷용으로 수정 : 그레고리하우스
 * @수정일 2019-06-01
 */

const util = require("util");
const SerialPort = require("serialport");
const net = require("net"); // Socket
const mqtt = require("mqtt");

const CONFIG = require("/data/options.json"); //**** 애드온의 옵션을 불러옵니다. 이후 CONFIG.mqtt.username 과 같이 사용가능합니다.

const CONST = {
    // 포트이름 설정/dev/ttyUSB0
    portName: process.platform.startsWith("win") ? "COM6" : CONFIG.serial.port,
    // SerialPort 전송 Delay(ms)
    sendDelay: CONFIG.sendDelay,
    // MQTT 브로커
    mqttBroker: "mqtt://" + CONFIG.mqtt.server, // *************** 환경에 맞게 수정하세요! **************
    // MQTT 수신 Delay(ms)
    mqttDelay: CONFIG.mqtt.receiveDelay,

    mqttUser: CONFIG.mqtt.username, // *************** 환경에 맞게 수정하세요! **************
    mqttPass: CONFIG.mqtt.password, // *************** 환경에 맞게 수정하세요! **************

    clientID: CONFIG.model + "-homenet",

    // 기기별 상태 및 제어 코드(HEX)
    DEVICE_STATE: [
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000100006c08", "hex"), power1: "ON", power2: "OFF", power3: "OFF" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000001006c08", "hex"), power1: "OFF", power2: "ON", power3: "OFF" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000000016c08", "hex"), power1: "OFF", power2: "OFF", power3: "ON" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000101006d0a", "hex"), power1: "ON", power2: "ON", power3: "OFF" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000001016d0a", "hex"), power1: "OFF", power2: "ON", power3: "ON" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000100016d0a", "hex"), power1: "ON", power2: "OFF", power3: "ON" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000101016c0a", "hex"), power1: "ON", power2: "ON", power3: "ON" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "1", stateHex: Buffer.alloc(11, "f70e118104000000006d08", "hex"), power1: "OFF", power2: "OFF", power3: "OFF" }, //거실1,2복도등 상태
        { deviceId: "Light", subId: "2", stateHex: Buffer.alloc(10, "F70e1281030000006904", "hex"), power1: "OFF", power2: "OFF" }, //방2등 all off
        { deviceId: "Light", subId: "2", stateHex: Buffer.alloc(10, "F70E1281030001016906", "hex"), power1: "ON", power2: "ON" }, //방2등 1,2 on
        { deviceId: "Light", subId: "2", stateHex: Buffer.alloc(10, "F70E1281030001006804", "hex"), power1: "ON", power2: "OFF" }, //방2등 1 on, 2 off
        { deviceId: "Light", subId: "2", stateHex: Buffer.alloc(10, "F70E1281030000016804", "hex"), power1: "OFF", power2: "ON" }, //방2등 1 off, 2 on
        { deviceId: "Light", subId: "3", stateHex: Buffer.alloc(9, "F70E13810200016804", "hex"), power: "ON" }, //방3등 상태
        { deviceId: "Light", subId: "3", stateHex: Buffer.alloc(9, "F70E13810200006904", "hex"), power: "OFF" }, //방3등 상태
        { deviceId: "Light", subId: "4", stateHex: Buffer.alloc(9, "F70E14810200016F0C", "hex"), power: "ON" }, //방4등 상태
        { deviceId: "Light", subId: "4", stateHex: Buffer.alloc(9, "F70E14810200006E0A", "hex"), power: "OFF" }, //방4등 상태
    ],

    DEVICE_COMMAND: [
        { deviceId: "Light", subId: "1-1", commandHex: Buffer.alloc(10, "f70e114103010100aa06", "hex"), power: "ON" }, //거실1등 점등
        { deviceId: "Light", subId: "1-1", commandHex: Buffer.alloc(10, "f70e114103010000ab06", "hex"), power: "OFF" }, //거실1등 소등
        { deviceId: "Light", subId: "1-2", commandHex: Buffer.alloc(10, "f70e114103020100a906", "hex"), power: "ON" }, //거실2등 점등
        { deviceId: "Light", subId: "1-2", commandHex: Buffer.alloc(10, "f70e114103020000a804", "hex"), power: "OFF" }, //거실2등 소등
        { deviceId: "Light", subId: "1-3", commandHex: Buffer.alloc(10, "f70e114103030100a806", "hex"), power: "ON" }, //복도등 점등
        { deviceId: "Light", subId: "1-3", commandHex: Buffer.alloc(10, "f70e114103030000a906", "hex"), power: "OFF" }, //복도등 소등
        { deviceId: "Light", subId: "2-1", commandHex: Buffer.alloc(10, "F70E124103010100A906", "hex"), power: "ON" }, //방2-1등 점등
        { deviceId: "Light", subId: "2-1", commandHex: Buffer.alloc(10, "F70E124103010000A804", "hex"), power: "OFF" }, //방2-1등 소등
        { deviceId: "Light", subId: "2-2", commandHex: Buffer.alloc(10, "F70E124103020100AA08", "hex"), power: "ON" }, //방2-2등 점등
        { deviceId: "Light", subId: "2-2", commandHex: Buffer.alloc(10, "F70E124103020000AB08", "hex"), power: "OFF" }, //방2-2등 소등
        { deviceId: "Light", subId: "3", commandHex: Buffer.alloc(10, "F70E134103010100A806", "hex"), power: "ON" }, //방3등 점등
        { deviceId: "Light", subId: "3", commandHex: Buffer.alloc(10, "F70E134103010000A906", "hex"), power: "OFF" }, //방3등 소등
        { deviceId: "Light", subId: "4", commandHex: Buffer.alloc(10, "F70E144103010100AF0E", "hex"), power: "ON" }, //방4등 점등
        { deviceId: "Light", subId: "4", commandHex: Buffer.alloc(10, "F70E144103010000AE0C", "hex"), power: "OFF" }, //방4등 소등
    ],

    // 상태 Topic (/homenet/${deviceId}${subId}/${property}/state/ = ${value})
    // 명령어 Topic (/homenet/${deviceId}${subId}/${property}/command/ = ${value})
    TOPIC_PRFIX: "homenet",
    STATE_TOPIC: "homenet/%s%s/%s/state", //상태 전달
    DEVICE_TOPIC: "homenet/+/+/command", //명령 수신
};

// 로그 표시
var log = (...args) => console.log("[" + new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + "]", args.join(" "));

//////////////////////////////////////////////////////////////////////////////////////
// 홈컨트롤 상태
var homeStatus = {};
var lastReceive = new Date().getTime();
var mqttReady = false;
var queue = new Array();

//////////////////////////////////////////////////////////////////////////////////////
// MQTT-Broker 연결
const client = mqtt.connect(CONST.mqttBroker, { clientId: CONST.clientID, username: CONST.mqttUser, password: CONST.mqttPass });
client.on("connect", () => {
    client.subscribe(CONST.DEVICE_TOPIC, (err) => {
        if (err) log("MQTT Subscribe fail! -", CONST.DEVICE_TOPIC);
    });
});

//-----------------------------------------------------------
// SerialPort 모듈 초기화
log("Initializing: SERIAL");
const port = new SerialPort(CONST.portName, {
    baudRate: CONFIG.serial.baudrate,
    dataBits: 8,
    parity: CONFIG.serial.parity,
    stopBits: 1,
    autoOpen: false,
    encoding: "hex",
});

port.on("open", () => log("Success open port:", CONST.portName));
port.open((err) => {
    if (err) {
        return log("Error opening port:", err.message);
    }
});

//////////////////////////////////////////////////////////////////////////////////////
// 홈넷에서 SerialPort로 상태 정보 수신
port.on("data", function (data) {
    //console.log('Receive interval: ', (new Date().getTime())-lastReceive, 'ms ->', data.toString('hex'));
    lastReceive = new Date().getTime();

    switch (data[3]) {
        case 0x81: //조명 상태 정보
            var objFound = CONST.DEVICE_STATE.find((obj) => data.equals(obj.stateHex));
            if (objFound) updateStatus(objFound);
            break;
        case 0xc1:
            // Ack 메시지를 받은 명령은 제어 성공하였으므로 큐에서 삭제
            const ack1 = Buffer.alloc(1);
            data.copy(ack1, 0, 1, 2);
            var objFoundIdx = queue.findIndex((obj) => obj.commandHex.includes(ack1));
            if (objFoundIdx > -1) {
                log("[Serial] Success command:", data.toString("hex"));
                queue.splice(objFoundIdx, 1);
            }
            break;
    }
});

//////////////////////////////////////////////////////////////////////////////////////
// MQTT로 HA에 상태값 전송

var updateStatus = (obj) => {
    var arrStateName = Object.keys(obj);
    // 상태값이 아닌 항목들은 제외 [deviceId, subId, stateHex, commandHex, ackHex, sentTime]
    const arrFilter = ["deviceId", "subId", "stateHex", "commandHex", "ackHex", "sentTime"];
    arrStateName = arrStateName.filter((stateName) => !arrFilter.includes(stateName));

    // 상태값별 현재 상태 파악하여 변경되었으면 상태 반영 (MQTT publish)
    arrStateName.forEach(function (stateName) {
        // 상태값이 없거나 상태가 같으면 반영 중지
        var curStatus = homeStatus[obj.deviceId + obj.subId + stateName];
        if (obj[stateName] == null || obj[stateName] === curStatus) return;
        // 미리 상태 반영한 device의 상태 원복 방지
        if (queue.length > 0) {
            var found = queue.find((q) => q.deviceId + q.subId === obj.deviceId + obj.subId && q[stateName] === curStatus);
            if (found != null) return;
        }
        // 상태 반영 (MQTT publish)
        homeStatus[obj.deviceId + obj.subId + stateName] = obj[stateName];
        var topic = util.format(CONST.STATE_TOPIC, obj.deviceId, obj.subId, stateName);
        client.publish(topic, obj[stateName], { retain: true });
        log("[MQTT] Send to HA:", topic, "->", obj[stateName]);
    });
};

//////////////////////////////////////////////////////////////////////////////////////
// HA에서 MQTT로 제어 명령 수신
client.on("message", (topic, message) => {
    if (mqttReady) {
        var topics = topic.split("/");
        var value = message.toString(); // message buffer이므로 string으로 변환
        var objFound = null;
        objFound = CONST.DEVICE_COMMAND.find((obj) => obj.deviceId + obj.subId === topics[1] && obj[topics[2]] === value);

        if (objFound == null) {
            log("[MQTT] Receive Unknown Msg.: ", topic, ":", value);
            return;
        }

        // 현재 상태와 같으면 Skip
        if (value === homeStatus[objFound.deviceId + objFound.subId + objFound[topics[2]]]) {
            log("[MQTT] Receive & Skip: ", topic, ":", value);
        }
        // Serial메시지 제어명령 전송 & MQTT로 상태정보 전송
        else {
            log("[MQTT] Receive from HA:", topic, ":", value);
            // 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 sendDelay만큼 이전으로 설정
            objFound.sentTime = new Date().getTime() - CONST.sendDelay;
            queue.push(objFound); // 실행 큐에 저장
            updateStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
        }
    }
});

//////////////////////////////////////////////////////////////////////////////////////
// SerialPort로 제어 명령 전송

const commandProc = () => {
    // 큐에 처리할 메시지가 없으면 종료
    if (queue.length == 0) return;

    // 기존 홈넷 RS485 메시지와 충돌하지 않도록 Delay를 줌
    var delay = new Date().getTime() - lastReceive;
    if (delay < CONST.sendDelay) return;

    // 큐에서 제어 메시지 가져오기
    var obj = queue.shift();
    port.write(obj.commandHex, (err) => {
        if (err) return log("[Serial] Send Error: ", err.message);
    });
    lastReceive = new Date().getTime();
    obj.sentTime = lastReceive; // 명령 전송시간 sentTime으로 저장
    log("[Serial] Send to Device:", obj.deviceId, obj.subId, "->", obj.state, "(" + delay + "ms) ", obj.commandHex.toString("hex"));

    // 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행
    queue.push(obj);
};

setTimeout(() => {
    mqttReady = true;
    log("MQTT Ready...");
}, CONST.mqttDelay);
setInterval(commandProc, 20);
