#!/usr/bin/env python3
"""
PID serial simulator — a fake "single-chip" that speaks the PID串口调试助手 protocol.

It runs a PID loop over a simulated first-order plant (think: a heater or a
motor speed loop), streams telemetry, and accepts tuning commands. Use it to
try the web tool at /pid without real hardware.

Telemetry it emits (one line per tick):
    pid,<t_ms>,<setpoint>,<measured>,<output>,<kp>,<ki>,<kd>

Commands it accepts (from the web tool):
    pid <kp> <ki> <kd>      set gains
    sp  <value>             set setpoint

Requires: pip install pyserial
Pair it with a virtual serial port so the browser can open the other end:
    Linux/macOS:  socat -d -d pty,raw,echo=0 pty,raw,echo=0
                  # then run:  python pid_serial_sim.py /dev/pts/5
                  # open the *other* /dev/pts/N in the browser
    Windows:      install com0com, then:  python pid_serial_sim.py COM5
"""

import sys
import time
import threading

try:
    import serial  # pyserial
except ImportError:
    sys.exit("需要 pyserial：请先运行  pip install pyserial")

BAUD = 115200
DT = 0.02  # 50 Hz control loop

# ── plant model: first-order lag with gain, plus a little inertia/noise ──
PLANT_GAIN = 1.6      # steady output per unit control effort
PLANT_TAU = 0.8       # time constant (s) — how sluggish the plant is
OUT_MIN, OUT_MAX = 0.0, 255.0

state = {
    "kp": 0.8,
    "ki": 0.05,
    "kd": 0.02,
    "sp": 0.0,
    "pv": 0.0,     # measured process value
    "integ": 0.0,
    "prev_err": 0.0,
}
lock = threading.Lock()


def reader(ser: "serial.Serial") -> None:
    """Listen for tuning / setpoint commands from the web tool."""
    buf = b""
    while True:
        try:
            chunk = ser.read(64)
        except Exception:
            return
        if not chunk:
            continue
        buf += chunk
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            handle(line.decode(errors="ignore").strip())


def handle(line: str) -> None:
    if not line:
        return
    parts = line.replace(",", " ").split()
    tag = parts[0].lower()
    try:
        with lock:
            if tag == "pid" and len(parts) >= 4:
                state["kp"], state["ki"], state["kd"] = (
                    float(parts[1]),
                    float(parts[2]),
                    float(parts[3]),
                )
                state["integ"] = 0.0
                print(f"[cmd] gains -> Kp={state['kp']} Ki={state['ki']} Kd={state['kd']}")
            elif tag in ("sp", "set", "setpoint") and len(parts) >= 2:
                state["sp"] = float(parts[1])
                print(f"[cmd] setpoint -> {state['sp']}")
    except ValueError:
        print(f"[cmd] 无法解析: {line}")


def main() -> None:
    port = sys.argv[1] if len(sys.argv) > 1 else None
    if not port:
        sys.exit("用法: python pid_serial_sim.py <串口>  (例如 /dev/pts/5 或 COM5)")

    ser = serial.Serial(port, BAUD, timeout=0.05)
    print(f"✅ 模拟单片机已启动 @ {port} ({BAUD})  —  按 Ctrl+C 退出")
    threading.Thread(target=reader, args=(ser,), daemon=True).start()

    t0 = time.time()
    while True:
        loop_start = time.time()
        with lock:
            err = state["sp"] - state["pv"]
            state["integ"] += err * DT
            deriv = (err - state["prev_err"]) / DT
            state["prev_err"] = err
            out = state["kp"] * err + state["ki"] * state["integ"] + state["kd"] * deriv
            out = max(OUT_MIN, min(OUT_MAX, out))
            # Anti-windup: stop integrating when saturated.
            if out in (OUT_MIN, OUT_MAX):
                state["integ"] -= err * DT
            # Plant response: dPV/dt = (gain*out - pv) / tau
            state["pv"] += (PLANT_GAIN * out - state["pv"]) / PLANT_TAU * DT
            kp, ki, kd, sp, pv = (
                state["kp"], state["ki"], state["kd"], state["sp"], state["pv"],
            )

        t_ms = int((time.time() - t0) * 1000)
        line = f"pid,{t_ms},{sp:.2f},{pv:.3f},{out:.2f},{kp:.4f},{ki:.4f},{kd:.4f}\n"
        try:
            ser.write(line.encode())
        except Exception as exc:
            print(f"写串口失败: {exc}")
            break

        elapsed = time.time() - loop_start
        time.sleep(max(0.0, DT - elapsed))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🚪 退出模拟器")
