package com.monitorapp.ui.camera

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import com.monitorapp.R

class CameraAdapter(
    private var cameras: List<CameraItem>,
    private val onItemClick: (CameraItem) -> Unit
) : RecyclerView.Adapter<CameraAdapter.CameraViewHolder>() {

    class CameraViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val cardView: MaterialCardView = view.findViewById(R.id.camera_card)
        val nameLabel: TextView = view.findViewById(R.id.camera_name)
        val idLabel: TextView = view.findViewById(R.id.camera_id)
        val statusLabel: TextView = view.findViewById(R.id.camera_status)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CameraViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_camera, parent, false)
        return CameraViewHolder(view)
    }

    override fun onBindViewHolder(holder: CameraViewHolder, position: Int) {
        val camera = cameras[position]
        holder.nameLabel.text = camera.name
        holder.idLabel.text = camera.id
        holder.statusLabel.text = camera.status
        
        // 设置状态颜色
        val statusColor = if (camera.isOnline) {
            R.color.status_online
        } else {
            R.color.status_offline
        }
        holder.statusLabel.setTextColor(holder.itemView.context.getColor(statusColor))
        
        holder.cardView.setOnClickListener {
            onItemClick(camera)
        }
    }

    override fun getItemCount() = cameras.size
    
    fun updateCameras(newCameras: List<CameraItem>) {
        cameras = newCameras
        notifyDataSetChanged()
    }
}