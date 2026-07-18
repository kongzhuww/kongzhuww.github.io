import paho.mqtt.client as mqtt
import json
import time

# 配置信息 (必须与你网页上添加设备的 Topic 一致)
BROKER = "broker.emqx.io"
PORT = 1883 

# !! 修改这里 !!
# 将这里的 Topic 换成你在网页里填写的那个 Base Topic
BASE_TOPIC = "stm32" # 你说你的设备名叫 stm32
CMD_TOPIC = f"{BASE_TOPIC}/command"
REPLY_TOPIC = f"{BASE_TOPIC}/reply"

# 设备当前状态
led_status = "OFF"

# 连接成功回调
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ 成功连接到 MQTT Broker ({BROKER})")
        # 订阅指令频道
        client.subscribe(CMD_TOPIC)
        print(f"📡 正在监听指令 Topic: {CMD_TOPIC}")
        
        # 上线时发个心跳
        report_status(client)
    else:
        print(f"❌ 连接失败, 错误码: {rc}")

# 接收消息回调
def on_message(client, userdata, msg):
    global led_status
    print("\n-------------------------")
    print(f"📥 收到来自 {msg.topic} 的消息:")
    payload_str = msg.payload.decode('utf-8')
    print(payload_str)
    
    try:
        data = json.loads(payload_str)
        action = data.get("action")
        
        if action == "LED_ON":
            led_status = "ON"
            print("💡 执行动作: 打开灯光！")
            report_status(client, "LED has been turned ON")
            
        elif action == "LED_OFF":
            led_status = "OFF"
            print("🌑 执行动作: 关闭灯光！")
            report_status(client, "LED has been turned OFF")
            
        elif action == "GET_STATUS":
            print("📊 执行动作: 网页请求状态")
            report_status(client, f"Current LED Status is {led_status}")
            
    except json.JSONDecodeError:
        print("⚠️ 无法解析 JSON 消息")

# 发送状态汇报给网页
def report_status(client, message="Device is online"):
    payload = json.dumps({
        "status": led_status,
        "msg": message,
        "timestamp": int(time.time())
    })
    client.publish(REPLY_TOPIC, payload)
    print(f"📤 发送回复到 {REPLY_TOPIC} -> {payload}")

# 初始化 MQTT 客户端
client = mqtt.Client(client_id=f"python_sim_{int(time.time())}")
client.on_connect = on_connect
client.on_message = on_message

print("🔄 正在连接 Broker...")
try:
    client.connect(BROKER, PORT, 60)
    # 阻塞运行，保持连接
    client.loop_forever()
except KeyboardInterrupt:
    print("\n🚪 退出测试脚本")
    client.disconnect()
