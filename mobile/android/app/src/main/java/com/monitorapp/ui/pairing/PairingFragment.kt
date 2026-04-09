package com.monitorapp.ui.pairing

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.monitorapp.R
import com.monitorapp.data.CameraRepository
import com.monitorapp.network.ApiClient
import com.google.zxing.integration.android.IntentIntegrator
import kotlinx.coroutines.launch

class PairingFragment : Fragment() {

    private lateinit var scanQrButton: MaterialButton
    private lateinit var smartConfigButton: MaterialButton
    private var wifiManager: WifiManager? = null
    private var isSmartConfigRunning = false
    private lateinit var cameraRepository: CameraRepository

    companion object {
        private const val CAMERA_PERMISSION_REQUEST_CODE = 1001
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val root = inflater.inflate(R.layout.fragment_pairing, container, false)
        
        // 初始化数据仓库
        val apiClient = ApiClient.getInstance(requireContext())
        cameraRepository = CameraRepository.getInstance(apiClient)
        
        scanQrButton = root.findViewById(R.id.scan_qr_button)
        smartConfigButton = root.findViewById(R.id.smart_config_button)
        
        // 初始化WiFi管理器
        wifiManager = context?.getSystemService(Context.WIFI_SERVICE) as WifiManager?
        
        scanQrButton.setOnClickListener {
            scanQRCode()
        }
        
        smartConfigButton.setOnClickListener {
            startSmartConfig()
        }
        
        return root
    }

    private fun startSmartConfig() {
        if (isSmartConfigRunning) {
            val message = "配网已在进行中"
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            Log.d("PairingFragment", message)
            return
        }
        
        // 检查WiFi是否开启
        if (wifiManager?.isWifiEnabled != true) {
            val message = "请先开启WiFi"
            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
            Log.d("PairingFragment", message)
            return
        }
        
        isSmartConfigRunning = true
        smartConfigButton.isEnabled = false
        smartConfigButton.text = "配网中..."
        
        // 在实际项目中，这里应该发送SmartConfig数据包
        // 模拟SmartConfig过程
        val message = "开始SmartConfig配网，请确保摄像头处于配网模式\n请按住摄像头Reset键5秒至指示灯闪烁"
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        Log.d("PairingFragment", message)
        
        // 模拟配网过程
        view?.postDelayed({
            isSmartConfigRunning = false
            smartConfigButton.isEnabled = true
            smartConfigButton.text = "一键配网"
            
            // 模拟配网成功，自动完成设备绑定
            val successMessage = "配网成功，设备已自动绑定"
            Toast.makeText(context, successMessage, Toast.LENGTH_LONG).show()
            Log.d("PairingFragment", successMessage)
            
            // 模拟添加摄像头到列表并返回上一个页面
            findNavController().popBackStack()
        }, 5000)
    }
    
    private fun scanQRCode() {
        // 检查相机权限
        if (ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            // 请求相机权限
            Log.d("PairingFragment", "请求相机权限")
            ActivityCompat.requestPermissions(
                requireActivity(),
                arrayOf(Manifest.permission.CAMERA),
                CAMERA_PERMISSION_REQUEST_CODE
            )
            return
        }
        
        // 启动二维码扫描
        startQRCodeScan()
    }
    
    private fun startQRCodeScan() {
        Log.d("PairingFragment", "启动二维码扫描")
        val integrator = IntentIntegrator.forSupportFragment(this)
        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE)
        integrator.setPrompt("请将二维码对准扫描框")
        integrator.setCameraId(0)
        integrator.setBeepEnabled(false)
        integrator.setBarcodeImageEnabled(true)
        integrator.initiateScan()
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // 权限已授予，启动二维码扫描
                Log.d("PairingFragment", "相机权限已授予，启动二维码扫描")
                startQRCodeScan()
            } else {
                // 权限被拒绝
                val message = "需要相机权限才能扫描二维码"
                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                Log.d("PairingFragment", message)
            }
        }
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null) {
            if (result.contents == null) {
                val message = "二维码扫描已取消"
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                Log.d("PairingFragment", message)
            } else {
                val message = "扫描到二维码内容: ${result.contents}"
                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                Log.d("PairingFragment", message)
                // 通过二维码内容直接启动配网流程
                startSmartConfigFromQRCode(result.contents)
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }
    
    private fun startSmartConfigFromQRCode(qrContent: String) {
        // 从二维码内容中提取配网信息并启动配网
        val message = "从二维码获取配网信息: $qrContent\n开始自动配网..."
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        Log.d("PairingFragment", message)
        
        // 模拟配网过程
        view?.postDelayed({
            val successMessage = "配网成功，设备已自动绑定"
            Toast.makeText(context, successMessage, Toast.LENGTH_LONG).show()
            Log.d("PairingFragment", successMessage)
            
            // 模拟添加摄像头到列表并返回上一个页面
            findNavController().popBackStack()
        }, 3000)
    }
}