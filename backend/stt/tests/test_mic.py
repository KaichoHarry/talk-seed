import sounddevice as sd

print("Default device:")
print(sd.default.device)

print("\nDevices:")
print(sd.query_devices())