import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Image, Pressable, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import MaskedView from '@react-native-masked-view/masked-view';
import uuid from 'react-native-uuid';
import axios from 'axios';

export default function InputScreen() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const userId = `ThunkerID_${uuid.v4()}`; 

  const handleSearch = async () => {
    try {
      const response = await axios.get('http://localhost:3000/search', {
        params: { userId, query }
      });
      const results = response.data;
      console.log(results);
      router.push({
        pathname: '/results',
        params: { results: JSON.stringify(results) , query , userId},
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image source={require('../assets/images/thunkLogo.png')} style={styles.logo} />
      <View style={styles.maskedContainer}>
        <MaskedView
          style={{ flex: 1, flexDirection: 'row', height: '100%' }}
          maskElement={
            <View style={styles.maskedContent}>
              <Text style={styles.maskedText}>Forge a Bond with</Text>
              <Text style={styles.maskedText}>your Fellow Thinker</Text>
            </View>
          }
        >
          <Image source={require('../assets/images/bgFont.png')} style={styles.maskedImage} />
        </MaskedView>
      </View>
      <Text style={styles.instructions}>Share a Thought to Find your Intellectual Twin.</Text>
      <KeyboardAvoidingView  style={{width:"100%"}}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Your Thought please..."
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={setQuery}
        />
        <Pressable onPress={handleSearch} style={styles.pressable}>
          <Image source={require('../assets/images/send.png')} style={styles.send} />
        </Pressable>
      </View>
      </KeyboardAvoidingView>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  logo: {
    width: 120,
    height: 50,
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex:1
  },
  maskedContainer: {
    height: 180,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskedContent: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskedText: {
    fontSize: 26,
    color: 'black',
    fontWeight: 'bold',
  },
  maskedImage: {
    flex: 1,
    height: '100%',
    resizeMode: 'contain',
  },
  instructions: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    width:"100%",
    height: 50,
    borderWidth: 1,
    fontSize: 14,
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 10,
    color: '#fff',
    backgroundColor: '#383838',
    paddingRight: 50,
  },
  send: {
    width: 20,
    height: 20
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    paddingHorizontal:"10%"
  },
  pressable: {
    position: 'absolute',
    top: "22%",
    right:"15%",
  }
});