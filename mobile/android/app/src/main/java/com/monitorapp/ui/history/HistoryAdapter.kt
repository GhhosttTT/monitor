package com.monitorapp.ui.history

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import com.google.android.material.button.MaterialButton
import com.monitorapp.R

class HistoryAdapter(
    private val historyItems: List<HistoryItem>,
    private val onItemClick: (HistoryItem) -> Unit = {}
) : RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

    class HistoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val cardView: MaterialCardView = itemView.findViewById(R.id.history_card)
        val dateTimeText: TextView = itemView.findViewById(R.id.history_date_time)
        val cameraNameText: TextView = itemView.findViewById(R.id.history_camera_name)
        val durationText: TextView = itemView.findViewById(R.id.history_duration)
        val statusText: TextView = itemView.findViewById(R.id.history_status)
        val playButton: MaterialButton = itemView.findViewById(R.id.play_button)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_history, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        val historyItem = historyItems[position]
        holder.dateTimeText.text = historyItem.dateTime
        holder.cameraNameText.text = historyItem.cameraName
        holder.durationText.text = historyItem.duration
        holder.statusText.text = historyItem.status
        
        // 根据状态设置不同的颜色
        when (historyItem.status) {
            "正常" -> holder.statusText.setTextColor(holder.itemView.context.getColor(R.color.start_button_normal))
            else -> holder.statusText.setTextColor(holder.itemView.context.getColor(R.color.text_primary))
        }
        
        // 设置点击事件
        holder.cardView.setOnClickListener {
            onItemClick(historyItem)
        }
        
        // 设置播放按钮点击事件
        holder.playButton.setOnClickListener {
            onItemClick(historyItem)
        }
    }

    override fun getItemCount() = historyItems.size
}