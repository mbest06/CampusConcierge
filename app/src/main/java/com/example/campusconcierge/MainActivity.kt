package com.example.campusconcierge

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.campusconcierge.ui.theme.CampusConciergeTheme

private data class ChatMessage(
    val text: String,
    val fromUser: Boolean
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CampusConciergeTheme {
                CampusConciergeScreen()
            }
        }
    }
}

@Composable
fun CampusConciergeScreen() {
    val messages = remember { mutableStateListOf<ChatMessage>() }
    var input by rememberSaveable { mutableStateOf("") }
    var historyExpanded by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFE8EEF2))
    ) {
        Text(
            text = "Map coming soon",
            modifier = Modifier.align(Alignment.Center),
            style = MaterialTheme.typography.headlineSmall,
            color = Color(0xFF60727D)
        )

        AnimatedVisibility(
            visible = historyExpanded,
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 92.dp),
            enter = fadeIn() + expandVertically(expandFrom = Alignment.Bottom),
            exit = fadeOut() + shrinkVertically(shrinkTowards = Alignment.Bottom)
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Conversation",
                            style = MaterialTheme.typography.titleLarge
                        )
                    }

                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(messages) { message ->
                            MessageBubble(message)
                        }
                    }
                }
            }
        }

        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 12.dp,
            shadowElevation = 8.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.Bottom
            ) {
                TextField(
                    value = input,
                    onValueChange = { input = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Ask CampusConcierge...") },
                    maxLines = 4,
                    shape = RoundedCornerShape(18.dp),
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        disabledIndicatorColor = Color.Transparent,
                        errorIndicatorColor = Color.Transparent
                    ),
                    leadingIcon = {
                        IconButton(onClick = { historyExpanded = !historyExpanded }) {
                            Text(if (historyExpanded) "⌄" else "⌃")
                        }
                    }
                )

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    onClick = {
                        val message = input.trim()
                        if (message.isNotEmpty()) {
                            messages.add(ChatMessage(message, fromUser = true))
                            messages.add(
                                ChatMessage(
                                    "I received your message. Agent responses will appear here.",
                                    fromUser = false
                                )
                            )
                            input = ""
                            historyExpanded = true
                        }
                    },
                    enabled = input.trim().isNotEmpty(),
                    modifier = Modifier.padding(bottom = 4.dp)
                ) {
                    Text("Send")
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.fromUser) {
            Arrangement.End
        } else {
            Arrangement.Start
        }
    ) {
        Surface(
            color = if (message.fromUser) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
            shape = RoundedCornerShape(16.dp)
        ) {
            Text(
                text = message.text,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                color = if (message.fromUser) {
                    MaterialTheme.colorScheme.onPrimary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}