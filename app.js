const nameInput = document.getElementById('nameInput');
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
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettingsButton = document.getElementById('closeSettingsButton');
const ageInput = document.getElementById('ageInput');
const sexInput = document.getElementById('sexInput');
const weightInput = document.getElementById('weightInput');
const heightFeetInput = document.getElementById('heightFeetInput');
const heightInchesInput = document.getElementById('heightInchesInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const promptInput = document.getElementById('promptInput');
const openRouterModel = 'openrouter/free';
const defaultPrompt = 'Describe this image clearly and concisely.';
let cameraStream;
let previewUrl;
let capturedPicture;
let cameraFacingMode = 'environment';

settingsOverlay.hidden = true;
settingsOverlay.setAttribute('aria-hidden', 'true');
apiKeyInput.value = localStorage.getItem('openRouterApiKey') || '';
nameInput.value = localStorage.getItem('userName') || '';
ageInput.value = localStorage.getItem('userAge') || '';
sexInput.value = localStorage.getItem('userSex') || '';
weightInput.value = localStorage.getItem('userWeight') || '';
heightFeetInput.value = localStorage.getItem('userHeightFeet') || '';
heightInchesInput.value = localStorage.getItem('userHeightInches') || '';

function openSettings() {
  settingsOverlay.hidden = false;
  settingsOverlay.setAttribute('aria-hidden', 'false');
  settingsButton.setAttribute('aria-expanded', 'true');
  nameInput.focus();
}

function closeSettings() {
  settingsOverlay.hidden = true;
  settingsOverlay.setAttribute('aria-hidden', 'true');
  settingsButton.setAttribute('aria-expanded', 'false');
}

settingsButton.addEventListener('click', () => {
  if (settingsOverlay.hidden) {
    openSettings();
  } else {
    closeSettings();
  }
});

closeSettingsButton.addEventListener('click', event => {
  event.stopPropagation();
  closeSettings();
});

settingsOverlay.addEventListener('click', event => {
  if (event.target === settingsOverlay) {
    closeSettings();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !settingsOverlay.hidden) {
    closeSettings();
  }
});

nameInput.addEventListener('input', () => {
  localStorage.setItem('userName', nameInput.value.trim());
});

ageInput.addEventListener('change', () => {
  localStorage.setItem('userAge', ageInput.value);
});

sexInput.addEventListener('change', () => {
  localStorage.setItem('userSex', sexInput.value);
});

weightInput.addEventListener('input', () => {
  localStorage.setItem('userWeight', weightInput.value);
});

heightFeetInput.addEventListener('input', () => {
  localStorage.setItem('userHeightFeet', heightFeetInput.value);
});

heightInchesInput.addEventListener('input', () => {
  localStorage.setItem('userHeightInches', heightInchesInput.value);
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
    openSettings();
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
    const prompt = promptInput.value.trim() || defaultPrompt;
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
            { type: 'text', text: prompt },
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
