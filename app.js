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
const closeCameraButton = document.getElementById('closeCameraButton');
const cameraStatus = document.getElementById('cameraStatus');
const photoPreview = document.getElementById('photoPreview');
let cameraStream;
let previewUrl;

cameraButton.addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = 'Camera access is not supported by this browser.';
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    cameraView.hidden = false;
    cameraButton.hidden = true;
    cameraStatus.textContent = '';
  } catch (error) {
    cameraStatus.textContent = 'Unable to access the camera. Check browser permission and use HTTPS or localhost.';
  }
});

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

    previewUrl = URL.createObjectURL(picture);
    photoPreview.src = previewUrl;
    photoPreview.hidden = false;
    stopCamera();
  }, 'image/jpeg', 0.9);
});

closeCameraButton.addEventListener('click', stopCamera);

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = undefined;
  }

  cameraVideo.srcObject = null;
  cameraView.hidden = true;
  cameraButton.hidden = false;
}
