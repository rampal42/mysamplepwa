const button = document.getElementById('clickMe');
const output = document.getElementById('output');

button.addEventListener('click', () => {
  const now = new Date().toLocaleTimeString();
  output.textContent = `Button tapped at ${now}`;
});

const cameraButton = document.getElementById('cameraButton');
const cameraView = document.getElementById('cameraView');
const cameraVideo = document.getElementById('cameraVideo');
const captureButton = document.getElementById('captureButton');
const describeButton = document.getElementById('describeButton');
const switchCameraButton = document.getElementById('switchCameraButton');
const closeCameraButton = document.getElementById('closeCameraButton');
const cameraStatus = document.getElementById('cameraStatus');
const photoPreview = document.getElementById('photoPreview');
const description = document.getElementById('description');
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const openRouterModel = 'openrouter/free';
let cameraStream;
let previewUrl;
let capturedPicture;
let cameraFacingMode = 'environment';

apiKeyInput.value = localStorage.getItem('openRouterApiKey') || '';

settingsButton.addEventListener('click', () => {
  const isOpen = settingsPanel.hidden;
  settingsPanel.hidden = !isOpen;
  settingsButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) {
    apiKeyInput.focus();
  }
});

apiKeyInput.addEventListener('input', () => {
  localStorage.setItem('openRouterApiKey', apiKeyInput.value.trim());
});

cameraButton.addEventListener('click', () => startCamera());

switchCameraButton.addEventListener('click', async () => {
  cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
});

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = 'Camera access is not supported by this browser.';
    return;
  }

  const previousFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';

  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = undefined;
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: cameraFacingMode } },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    cameraView.hidden = false;
    cameraButton.hidden = true;
    captureButton.hidden = false;
    switchCameraButton.hidden = false;
    switchCameraButton.textContent = cameraFacingMode === 'environment'
      ? 'Use front camera'
      : 'Use back camera';
    closeCameraButton.hidden = false;
    cameraStatus.textContent = '';
  } catch (error) {
    cameraFacingMode = previousFacingMode;
    stopCamera();
    cameraStatus.textContent = 'Unable to access the camera. Check browser permission and use HTTPS or localhost.';
  }
}

captureButton.addEventListener('click', () => {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    cameraStatus.textContent = 'The camera is still starting. Try again in a moment.';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  canvas.getContext('2d').drawImage(cameraVideo, 0, 0);

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  canvas.toBlob(picture => {
    if (!picture) {
      cameraStatus.textContent = 'The picture could not be captured.';
      return;
    }

    capturedPicture = picture;
    previewUrl = URL.createObjectURL(picture);
    photoPreview.src = previewUrl;
    photoPreview.hidden = false;
    describeButton.hidden = false;
    description.textContent = '';
    stopCamera();
  }, 'image/jpeg', 0.9);
});

closeCameraButton.addEventListener('click', stopCamera);

describeButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    settingsPanel.hidden = false;
    settingsButton.setAttribute('aria-expanded', 'true');
    apiKeyInput.focus();
    cameraStatus.textContent = 'Enter an OpenRouter API key in Settings first.';
    return;
  }

  if (!capturedPicture) {
    cameraStatus.textContent = 'Take a picture before requesting a description.';
    return;
  }

  describeButton.disabled = true;
  cameraStatus.textContent = 'Describing picture...';
  description.textContent = '';

  try {
    const imageData = await blobToBase64(capturedPicture);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image clearly and concisely.' },
            {
              type: 'image_url',
              image_url: { url: `data:${capturedPicture.type};base64,${imageData}` }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorResult = await response.json().catch(() => null);
      const providerMessage = errorResult?.error?.message;
      throw new Error(providerMessage || `API request failed with status ${response.status}`);
    }

    const result = await response.json();
    const messageContent = result.choices?.[0]?.message?.content;
    const text = typeof messageContent === 'string'
      ? messageContent
      : messageContent?.map(part => part.text).filter(Boolean).join(' ');

    if (!text) {
      throw new Error('The API returned no description.');
    }

    description.textContent = text;
    cameraStatus.textContent = '';
  } catch (error) {
    cameraStatus.textContent = 'Unable to describe the picture. Check the API key and try again.';
    console.error(error);
  } finally {
    describeButton.disabled = false;
  }
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = undefined;
  }

  cameraVideo.srcObject = null;
  cameraView.hidden = true;
  cameraButton.hidden = false;
  captureButton.hidden = true;
  switchCameraButton.hidden = true;
  closeCameraButton.hidden = true;
}
