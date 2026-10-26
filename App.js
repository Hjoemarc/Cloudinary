import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

// ==========================================
// CONFIGURATION
// ==========================================

// 💡 TIP FOR STUDENTS:
// - Web Browser: "http://localhost:3002" always works on your computer.
// - Mobile Device (Expo Go): Replace "192.168.1.110" with your computer's current Wi-Fi IPv4 address.
const API_URL =
  Platform.OS === "web"
    ? "http://localhost:3002"
    : "http://192.168.1.110:3002";

const CLOUDINARY_CLOUD_NAME = "dwo1a7szf";
const CLOUDINARY_UPLOAD_PRESET = "eReadApp";

export default function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  // Helper: Display alert popups compatible with Web browsers and Mobile devices
  function showMessage(title, message) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  // ==========================================
  // STEP 1: FETCH STUDENTS FROM BACKEND
  // ==========================================
  async function getStudents() {
    try {
      const response = await fetch(`${API_URL}/students`);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setStudents(data);
    } catch (error) {
      console.error("Fetch error:", error);
      showMessage(
        "Connection Error",
        `Unable to reach backend at ${API_URL}.\nEnsure your Node.js server is running.`
      );
    } finally {
      setLoading(false);
    }
  }

  // Run getStudents once when the screen opens
  useEffect(() => {
    getStudents();
  }, []);

  // ==========================================
  // STEP 2: SELECT & UPLOAD STUDENT PHOTO
  // ==========================================
  async function uploadPhoto(student) {
    try {
      // 1. Open the device photo gallery
      // We pass `base64: true` so the image data can be uploaded uniformly across Web, iOS, and Android
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1], // Crop as a square
        quality: 0.7,   // Compress slightly to keep upload fast
        base64: true,   // Cross-platform binary encoding
      });

      // Stop if the user closed the picker without choosing an image
      if (pickerResult.canceled) {
        return;
      }

      const image = pickerResult.assets?.[0];
      if (!image?.uri) {
        throw new Error("No image was selected.");
      }

      // Show spinner on the selected student card
      setUploadingId(student._id);

      // 2. Prepare the Base64 Data URI for Cloudinary
      const mimeType = image.mimeType || "image/jpeg";
      const fileData = image.base64
        ? `data:${mimeType};base64,${image.base64}`
        : image.uri;

      const formData = new FormData();
      formData.append("file", fileData);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      // 3. Upload image directly to Cloudinary
      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const cloudinaryData = await cloudinaryResponse.json();

      if (!cloudinaryResponse.ok) {
        throw new Error(
          cloudinaryData.error?.message || "Cloudinary failed to upload image."
        );
      }

      const imageUrl = cloudinaryData.secure_url;
      if (!imageUrl) {
        throw new Error("Cloudinary did not return a secure image URL.");
      }

      // 4. Send the Cloudinary URL to our Express backend to update MongoDB
      const databaseResponse = await fetch(
        `${API_URL}/students/${student._id}/photo`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl }),
        }
      );

      // Check if Express accepted the update
      if (!databaseResponse.ok) {
        const rawResponse = await databaseResponse.text();
        let serverMessage = rawResponse;

        try {
          const errorJson = JSON.parse(rawResponse);
          serverMessage = errorJson.error || errorJson.message || rawResponse;
        } catch {
          // If response isn't JSON, retain raw text
        }

        throw new Error(serverMessage);
      }

      // 5. Instantly update React state so the UI shows the new image without a page refresh
      setStudents((currentStudents) =>
        currentStudents.map((item) =>
          String(item._id) === String(student._id)
            ? { ...item, imageUrl }
            : item
        )
      );

      showMessage("Success", "Student photo uploaded and saved successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      showMessage("Upload Failed", error.message || "Please try again.");
    } finally {
      setUploadingId(null);
    }
  }

  // ==========================================
  // STEP 3: LOADING SPINNER VIEW
  // ==========================================
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f9fafb",
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: "#4b5563" }}>
          Loading students from database...
        </Text>
      </View>
    );
  }

  // ==========================================
  // STEP 4: STUDENT LIST VIEW
  // ==========================================
  return (
    <FlatList
      data={students}
      keyExtractor={(item) => String(item._id)}
      contentContainerStyle={{
        padding: 20,
        flexGrow: 1,
        backgroundColor: "#f3f4f6",
      }}
      ListHeaderComponent={
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 20,
            color: "#111827",
            textAlign: "center",
          }}
        >
          Student Profiles
        </Text>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: "#6b7280", marginTop: 40 }}>
          No students found in database.
        </Text>
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: 16,
            marginBottom: 16,
            backgroundColor: "#ffffff",
            borderRadius: 12,
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 5,
            elevation: 2,
          }}
        >
          {/* Profile Picture */}
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                marginBottom: 12,
                backgroundColor: "#e5e7eb",
              }}
            />
          ) : (
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: "#e5e7eb",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "#6b7280", fontWeight: "500" }}>No Photo</Text>
            </View>
          )}

          {/* Student Name */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#1f2937",
              textAlign: "center",
            }}
          >
            {item.name || "Unnamed Student"}
          </Text>

          {/* Upload Button */}
          <Pressable
            onPress={() => uploadPhoto(item)}
            disabled={uploadingId !== null}
            style={{
              backgroundColor: uploadingId === item._id ? "#93c5fd" : "#2563eb",
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 8,
              marginTop: 14,
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {uploadingId === item._id ? "Uploading..." : "Choose & Upload Photo"}
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
}