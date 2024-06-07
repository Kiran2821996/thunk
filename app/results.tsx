import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, Image, ScrollView, Pressable, KeyboardAvoidingView, TextInput, Alert, Button } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { stringSimilarity } from "string-similarity-js";
import io from 'socket.io-client';
import axios from 'axios';

interface SearchResult {
  similarity: any;
  id: string;
  userId: string;
  query: string;
}

interface Message {
  userId: string;
  text: string;
  targetUserId: string;
}

interface ChatRequest {
  fromUserId: string;
  toUserId: string;
  thoughtText: string;
}

interface ChatStatus {
  activeChats: string[];
  pendingRequests: ChatRequest[];
}

export default function ResultsScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [finalResults, setFinalResults] = useState<SearchResult[]>([]);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [isChatAccepted, setIsChatAccepted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRequestSent, setIsRequestSent] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [activeChats, setActiveChats] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ChatRequest[]>([]);

  const [thoughtText, setThoughtText] = useState('');

  const socket = io('http://localhost:3000');
  const router = useRouter();

  const selectedUserIdRef = useRef<string | null>(null);

  const { results, query, userId } = useLocalSearchParams<{ results: string; query: string; userId: string }>();
  let parsedResults: SearchResult[] = [];

  try {
    if (typeof results === 'string') {
      parsedResults = JSON.parse(results);
    }
  } catch (error) {
    console.error('Error parsing results:', error);
  }

  let sortedResults = parsedResults.map(item => ({
    id: item.id,
    userId: item.userId,
    query: item.query,
    similarity: stringSimilarity(`${query}`, `${item.query}`),
  }));

  let initialResults = sortedResults.sort((a, b) => b.similarity - a.similarity);

  useEffect(() => {
    setFinalResults(initialResults);
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('register', userId);
    });

    socket.on('message', (data) => {
      if ((data.userId === userId && data.targetUserId === selectedUserIdRef.current) || (data.userId === selectedUserIdRef.current && data.targetUserId === userId)) {
        setMessages(prevMessages => [...prevMessages, data]);
      }
    });

    socket.on('newData', (newData: SearchResult) => {
      const newResult = {
        id: newData.id,
        userId: newData.userId,
        query: newData.query,
        similarity: stringSimilarity(`${query}`, `${newData.query}`),
      };

      setFinalResults((prevResults) => {
        const updatedResults = [...prevResults, newResult];
        return updatedResults.sort((a, b) => b.similarity - a.similarity);
      });
    });

    socket.on('deletedData', (deletedData: { id: string }) => {
      setFinalResults((prevResults) => {
        return prevResults.filter(result => result.id !== deletedData.id);
      });
    });

    socket.on('refreshApp', () => {
      // Reload the current page
      window.location.reload();
    });

    socket.on('chatRequest', (data: ChatRequest) => {
      if (data.toUserId === userId) {
        setChatRequests(prevRequests => [...prevRequests, data]);
        setTimer(5);
        setIsRequestSent(true);
      }
    });

    socket.on('chatAccepted', (data: ChatRequest) => {
      if (data.fromUserId === userId || data.toUserId === userId) {
        setIsChatAccepted(true);
        setChatVisible(true);
        setSelectedUserId(data.fromUserId === userId ? data.toUserId : data.fromUserId);
        selectedUserIdRef.current = data.fromUserId === userId ? data.toUserId : data.fromUserId;
      }
    });

    socket.on('closeChat', (data) => {
      if (data.toUserId === userId) {
        Alert.alert('Chat dropped by the thunker.');
        setChatVisible(false);
        setSelectedUserId(null);
        selectedUserIdRef.current = null;
        setMessages([]);
      }
    });

    socket.on('chatStatus', (data: ChatStatus) => {
      setActiveChats(data.activeChats);
      setPendingRequests(data.pendingRequests);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const countdown = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(countdown);
    } else if (timer === 0 && isRequestSent) {
      handleDeclineChat(selectedUserIdRef.current!);
      setIsRequestSent(false);
      setChatRequests([]);
    }
  }, [timer, isRequestSent]);

  const handleSendMessage = () => {
    if (newMessage.trim() && userId && selectedUserIdRef.current) {
      const message: Message = { userId, text: newMessage, targetUserId: selectedUserIdRef.current };
      socket.emit('message', message);
      setNewMessage('');
    } else {
      console.error('UserId or selectedUserId is missing.');
    }
  };

  const handleChatPress = (targetedId: string, query: string) => {
    if (activeChats.includes(targetedId) || pendingRequests.some((request: ChatRequest) => request.fromUserId === targetedId || request.toUserId === targetedId || request.fromUserId === userId)) {
      Alert.alert('User Busy or Chat Pending', 'This user is currently unavailable for chat.');
      return;
    }

    // Save the thought text when starting a chat
    setThoughtText(query);
    selectedUserIdRef.current = targetedId;
    setWaiting(true);
    setTimeout(() => {
      if(chatVisible){
        Alert.alert('Chat request has not been accepted by the thunker.');
      }
      
      setWaiting(false);
      setPendingRequests(prevRequests => prevRequests.filter(request => request.fromUserId !== userId || request.toUserId !== targetedId));
      socket.emit('chatStatus', { activeChats, pendingRequests });
    }, 6000);
    socket.emit('chatRequest', { fromUserId: userId, toUserId: targetedId, thoughtText: query });
  };


  const handleAcceptChat = (fromUserId: string) => {
    const chatRequest = chatRequests.find(request => request.fromUserId === fromUserId);
    if (chatRequest) {
      setThoughtText(chatRequest.thoughtText); // Set the thought text
    }
    socket.emit('acceptChat', { fromUserId, toUserId: userId });
    setIsRequestSent(false);
    setChatRequests([]);
  };

  const handleDeclineChat = (fromUserId: string) => {
    setChatRequests(prevRequests => prevRequests.filter(request => request.fromUserId !== fromUserId));
    setIsRequestSent(false);
    setChatRequests([]);
  };

  const handleCloseChatBox = () => {
    if (selectedUserIdRef.current) {
      socket.emit('closeChat', { fromUserId: userId, toUserId: selectedUserIdRef.current });
    }
    setChatVisible(false);
    setSelectedUserId(null);
    selectedUserIdRef.current = null;
    setMessages([]);
  };

  const handleEditThought = async () => {
    try {
      await axios.delete(`http://localhost:3000/search/${userId}/${query}`);
      router.back();
    } catch (error) {
      console.error('Error deleting data:', error);
    }
  };

  return (
    <View style={(chatRequests.length > 0 && isRequestSent) || chatVisible || waiting ? styles.containerRS : styles.container}>
      <StatusBar style="light" />
      <View style={styles.upper}>
        <Image source={require('../assets/images/thunkLogo.png')} style={styles.logo} />
        <View style={styles.headerWrapperINS}>
          <ScrollView style={{paddingRight:20}}>
            <Text style={styles.instructions}>{query}</Text>
          </ScrollView>
          <Pressable onPress={handleEditThought} style={styles.editButton}>
            <Image source={require('../assets/images/edit.png')} style={{ width: 20, height: 20 }} />
          </Pressable>
        </View>
      </View>
      <View style={styles.flatList}>
        <FlatList
          data={finalResults}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) =>
            <View style={{ flex: 1, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: "center", marginBottom: 20 }}>
              <View style={styles.textST}>
                <Text style={styles.item}>{item.query}</Text>
              </View>
              <Pressable onPress={() => handleChatPress(item.userId, `${query}`)} disabled={activeChats.includes(item.userId) || pendingRequests.some(request => request.fromUserId === item.userId || request.toUserId === item.userId)}>
                <View style={{ position: 'relative', flex: 0.1 }}>
                  <Image source={require('../assets/images/scoreBub.png')} style={{ width: 40, height: 40 }} />
                  <View style={{ width: 20, height: 20, position: 'absolute', top: -2, left: 0, zIndex: -1 }}>
                    <Image source={require('../assets/images/ellipseVo.png')} resizeMode='contain' style={{ width: Math.round(stringSimilarity(`${query}`, `${item.query}`) * 50), height: Math.round(stringSimilarity(`${query}`, `${item.query}`) * 50) }} />
                  </View>
                  <View style={{width: 100, height: 20, position: 'absolute',left:0,top:5}}>
                  {(activeChats.includes(item.userId) || pendingRequests.some(request => request.fromUserId === item.userId || request.toUserId === item.userId)) && (
                    <Text style={styles.busyText}>TIED</Text>
                  )}
                </View>
                </View>
                
                
              </Pressable>
            </View>
          }
        />
      </View>
      <Text style={styles.footer}>Powered by Team Thunks</Text>
      {waiting && <View style={styles.requestContainer}>
        <View style={{ width: "100%", height: "100%", position: 'absolute', top: "50%", left: "40%" }}>
          <Text style={styles.timerText}>Be Kind with your Thoughts Always...</Text>
        </View>
      </View>
      }
      {chatVisible && (
        <KeyboardAvoidingView behavior="padding" style={styles.chatBox}>
          <View style={{ flex: 0.1, height: "20%", width: "100%", flexDirection: "row", justifyContent: "space-between", borderBottomColor: "grey", borderBottomWidth: 2 }}>
            <ScrollView>
              <Text style={styles.instructions}>{query}</Text>
            </ScrollView>
            <Pressable onPress={handleCloseChatBox} style={styles.closeButton}>
              <Image source={require('../assets/images/crosser.png')} style={{ width: 20, height: 20 }} />
            </Pressable>
          </View>
          <View style={{ width: "100%", flex: 0.9 }}>
            <FlatList
              data={messages}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) =>
                <View style={{ flex: 1, width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start', alignContent: 'flex-start' }}>
                  {item.userId !== userId ? <Text style={{ color: 'white', width: '100%', fontSize: 20, fontWeight: "bold", paddingVertical: 10, textAlign: "right" }}>↓ {item.text}</Text> :
                    <Text style={{ color: 'grey', width: '100%', fontSize: 20, fontWeight: "bold", paddingVertical: 10, textAlign: "left" }}>{item.text} ↑</Text>}
                </View>
              }
            />
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter a message"
              placeholderTextColor={'black'}
              value={newMessage}
              onChangeText={setNewMessage}
              onSubmitEditing={handleSendMessage}
            />
            <Pressable onPress={handleSendMessage} style={styles.pressable}>
              <Image source={require('../assets/images/send.png')} style={styles.send} />
            </Pressable>
          </View>
          <View>
            <Text style={{color:"white",fontSize:14,fontWeight:700,paddingVertical:30}}>Chats are anonymous</Text>
          </View>
        </KeyboardAvoidingView>
      )}

      {chatRequests.length > 0 && isRequestSent && (
        <View style={styles.requestContainer}>
          {chatRequests.map(request => (
            <View key={request.fromUserId} style={{ position: "absolute",bottom:"20%" }}>
              <View style={styles.headerWrapperINSCUST}>
                <ScrollView>
                  <Text style={styles.instructions}>{request.thoughtText}</Text>
                </ScrollView>
                {/* <Pressable onPress={() => handleDeclineChat(request.fromUserId)} style={styles.editButton}>
                  <Image source={require('../assets/images/crosser.png')} style={{ width: 20, height: 20 }} />
                </Pressable> */}
              </View>
              <Pressable onPress={() => handleAcceptChat(request.fromUserId)}>
                <View style={{ position: 'relative', flex: 0.1 }}>
                  <Image source={require('../assets/images/scoreBub.png')} style={{ width: 100, height: 100 }} />
                  <View style={{ width: 20, height: 20, position: 'absolute', top: -2, left: 0, zIndex: -1 }}>
                    <Image source={require('../assets/images/ellipseVo.png')} resizeMode='contain' style={{ width: Math.round(stringSimilarity(`${query}`, `${request.thoughtText}`) * 100), height: Math.round(stringSimilarity(`${query}`, `${request.thoughtText}`) * 100) }} />
                  </View>
                  <View style={{ width: 50, height: 50, position: 'absolute', top: 20, left: 20 }}>
                    <Text style={styles.timerText}>{timer}</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerRS: { flex: 1, backgroundColor: "#383838", position: "relative", zIndex: 1 },
  container: { flex: 1, alignItems: 'center', backgroundColor: '#0C0C0C', padding: 20, justifyContent: "space-between" },
  logo: {
    width: 120,
    height: 50,
    position: 'absolute',
    top: 40
  },
  upper: { flex: 0.25, width: "100%" },
  headerWrapperINSCUST: {
    height: "50%", flexDirection: "row", paddingVertical: 5
  },
  headerWrapperINS: {
    height: 70, flexDirection: "row", justifyContent: 'center', alignItems: 'baseline', paddingVertical: 5, marginTop: "auto", borderBottomColor: 'grey',
    borderBottomWidth: 1,position:"relative"
  },
  instructions: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10, marginTop: 10, textAlign: 'left' },
  editButton: { paddingVertical: 20, paddingHorizontal: 10,height: 100, position:"absolute",top:0 ,right:0},
  flatList: { flex: 0.7, width: '100%', marginBottom: 20 },
  textST: { flex: 0.9, textAlign: "left", width: "100%" },
  item: { color: 'white', fontSize: 18, width: "100%", },
  footer: { color: 'white', fontSize: 12, marginBottom: 20, marginTop: 10 },
  chatBox: { position: 'absolute', width: "100%", height: "100%", padding: 40, paddingVertical: 100, borderRadius: 10, alignItems: 'center', backgroundColor: '#383838', zIndex: 2 },
  notificationBubble: { backgroundColor: 'red', borderRadius: 10, padding: 5 },
  notificationText: { color: 'white' },
  requestContainer: { position: 'absolute', width: "100%", height: "100%", padding: 20, borderRadius: 10, alignItems: 'center', backgroundColor: '#383838', zIndex: 2 },
  timerText: { color: 'white', fontSize: 32, fontWeight: 'bold' ,width: "60%",lineHeight:50},
  declineButton: { position: "absolute", right: 0, bottom: 30 },
  input: {
    height: 50,
    borderWidth: 1,
    fontSize: 18,
    borderRadius: 8,
    marginBottom: "20%",
    width: '100%',
    paddingHorizontal: 10,
    color: 'white',
    backgroundColor: 'black',
    paddingRight: 50,
  },
  send: {
    width: 20,
    height: 20
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
  },
  pressable: {
    position: 'absolute',
    top: "11%",
    right: 8,
  },
  busyText: {
    fontSize: 14,
    fontWeight:"bold",
    color: 'white',
    marginTop: 5,
    marginLeft:5
  },
  thoughtText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
    textAlign: 'center',
    width: '80%'
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
});