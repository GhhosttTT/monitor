Import("env")

# 添加额外的编译标志
env.Append(CPPDEFINES=[
    ("ARDUINO_ESP32_DEV", "1"),
    ("ESP_PLATFORM", "1")
])

# 确保包含所有必要的目录
env.Append(CPPPATH=[
    "#include",
    "#src"
])