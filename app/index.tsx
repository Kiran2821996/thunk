import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function LogoScreen() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => {
      router.push('/input');
    }, 2000); // Change this value to adjust the duration of the splash screen
  }, [router]);

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/thunkLogo.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  logo: {
    width: 210,
    height: 100,
  },
});
