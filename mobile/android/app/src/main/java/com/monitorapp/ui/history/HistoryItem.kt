package com.monitorapp.ui.history

data class HistoryItem(
    val dateTime: String,
    val cameraName: String,
    val duration: String,
    val status: String
)