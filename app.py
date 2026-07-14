import os
import shutil

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from llm_structure import LectureMindMap
from main import run_pipeline

load_dotenv()

app = FastAPI(title="LectureLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


HOME_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LectureLens</title>
  
  <!-- VIS-Network CDN for Interactive Node Diagrams -->
  <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.9/standalone/umd/vis-network.min.js"></script>
  
  <style>
    :root { 
      color-scheme: dark; 
      --bg:#0a1020; 
      --panel:rgba(12,18,37,.88); 
      --text:#eef2ff; 
      --muted:#9aa8c7; 
      --accent:#69f0ae; 
      --accent-2:#7dd3fc; 
      --border:rgba(125,211,252,.18); 
      --shadow:0 24px 80px rgba(0,0,0,.38); 
    }
    * { box-sizing: border-box; }
    body { 
      margin:0; 
      min-height:100vh; 
      font-family:"Segoe UI","Trebuchet MS",sans-serif; 
      color:var(--text); 
      background:radial-gradient(circle at top left, rgba(125,211,252,.16), transparent 30%), radial-gradient(circle at right 20%, rgba(105,240,174,.14), transparent 28%), linear-gradient(145deg, #07111f 0%, #0a1020 55%, #081523 100%); 
      display:grid; 
      place-items:center; 
      padding:28px; 
    }
    .shell { width:min(1200px, 100%); display:grid; gap:18px; }
    .hero, .card { border:1px solid var(--border); box-shadow:var(--shadow); background:linear-gradient(180deg, rgba(17,26,51,.95), rgba(9,16,32,.92)); }
    .hero { padding:28px; border-radius:24px; }
    .card { padding:22px; border-radius:22px; backdrop-filter:blur(12px); background:var(--panel); display: flex; flex-direction: column; }
    h1 { margin:0 0 8px; font-size:clamp(2.2rem, 4vw, 4rem); letter-spacing:-.04em; }
    p { color:var(--muted); line-height:1.55; }
    .grid { display:grid; grid-template-columns:380px 1fr; gap:18px; }
    .dropzone { border:1.5px dashed rgba(125,211,252,.34); border-radius:18px; padding:22px; background:rgba(255,255,255,.03); transition:180ms ease; cursor:pointer; }
    .dropzone:hover { border-color:rgba(105,240,174,.7); transform:translateY(-1px); }
    .dropzone strong { display:block; font-size:1.05rem; margin-bottom:6px; }
    input[type="file"] { width:100%; margin-top:10px; color:var(--muted); }
    
    /* Standard interactive button */
    button { 
      margin-top:14px; 
      width:100%; 
      border:0; 
      padding:14px 16px; 
      border-radius:14px; 
      font-weight:700; 
      letter-spacing:.02em; 
      color:#07111f; 
      background:linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%); 
      cursor:pointer; 
      transition: opacity 0.2s;
    }
    button:disabled { opacity:.65; cursor:not-allowed; }
    .status { min-height:24px; margin-top:12px; color:var(--muted); }
    
    /* Secondary export buttons */
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 10px 16px;
      font-size: 0.9rem;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
      width: auto;
      margin-top: 0;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    
    .export-bar {
      display: flex;
      gap: 12px;
      margin-top: 14px;
      justify-content: flex-end;
    }
    
    /* Interactive Canvas Setup */
    #mynetwork { 
      width: 100%; 
      height: 520px; 
      border-radius: 16px; 
      background: rgba(6,10,20,.74); 
      border: 1px solid rgba(125,211,252,.14); 
    }
    
    .meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; color:var(--muted); font-size:.95rem; }
    .pill { padding:8px 12px; border-radius:999px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.06); }
    @media (max-width:860px) { .grid { grid-template-columns:1fr; } body { padding:16px; } }

    /* Print-specific layout rules */
    @media print {
      body { background: white !important; color: black !important; padding: 0; }
      .hero, .card:first-child, .export-bar { display: none !important; }
      .grid { grid-template-columns: 1fr !important; }
      .card { border: none !important; box-shadow: none !important; background: transparent !important; }
      #mynetwork { border: none !important; height: 95vh !important; background: white !important; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <h1>LectureLens</h1>
      <p>Upload a lecture recording, transcribe it with Deepgram, and transform it into an interactive structural mind map with Groq.</p>
      <div class="meta">
        <span class="pill">Audio → Transcript → Mind map</span>
        <span class="pill">Single-page browser client</span>
        <span class="pill">FastAPI backend</span>
      </div>
    </section>
    
    <section class="grid">
      <!-- Left Control Panel -->
      <div class="card">
        <div class="dropzone" id="dropzone">
          <strong>Select a lecture audio or video file</strong>
          <span>MP3, WAV, M4A, MP4, and similar formats work best.</span>
          <input id="audioFile" type="file" accept="audio/*,video/*" />
          <button id="submitBtn" type="button">Process lecture</button>
          <div class="status" id="status">Ready.</div>
        </div>
      </div>
      
      <!-- Right Interactive Visual Canvas -->
      <div class="card">
        <strong style="display:block;margin-bottom:12px;">Interactive Visual Mind Map</strong>
        <div id="mynetwork"></div>
        
        <!-- Interactive Tool Action Bar (New!) -->
        <div class="export-bar" id="exportBar" style="display: none;">
          <button class="btn-secondary" onclick="downloadCanvas()">
            💾 Download Image (PNG)
          </button>
          <button class="btn-secondary" onclick="printMap()">
            🖨️ Print Mind Map
          </button>
        </div>
      </div>
    </section>
  </main>

  <script>
    const fileInput = document.getElementById('audioFile');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');
    const networkDiv = document.getElementById('mynetwork');
    const dropzone = document.getElementById('dropzone');
    const exportBar = document.getElementById('exportBar');

    let network = null;

    // Helper to format nodes and edges for vis-network
    function renderMindMap(data) {
      if (!data.nodes || data.nodes.length === 0) {
        networkDiv.innerHTML = "<div style='color: var(--muted); padding: 20px;'>No structural nodes found.</div>";
        exportBar.style.display = 'none';
        return;
      }

      // Map backend schema parameters into visual canvas aesthetics
      const visNodes = data.nodes.map(node => {
        let color = '#3b82f6'; // Default Sub_topic (Blue)
        let border = '#1d4ed8';
        let shape = 'box';

        if (node.type === 'main_topic') {
          color = '#10b981'; // Green
          border = '#047857';
          shape = 'ellipse';
        } else if (node.type === 'insight') {
          color = '#8b5cf6'; // Purple
          border = '#6d28d9';
        } else if (node.type === 'note') {
          color = '#f59e0b'; // Amber
          border = '#b45309';
        }

        return {
          id: node.id,
          label: `<b>${node.label}</b>`,
          title: node.summary, // Tooltip on hover
          shape: shape,
          margin: 12,
          font: {
            color: '#ffffff',
            multi: 'html',
            size: 15
          },
          color: {
            background: color,
            border: border,
            highlight: {
              background: '#ffffff',
              border: '#69f0ae'
            }
          },
          borderWidth: 2,
          shadow: true
        };
      });

      // EDGES: Upgraded visibility metrics
      const visEdges = data.edges.map(edge => {
        return {
          id: edge.id,
          from: edge.source,
          to: edge.target,
          label: edge.label,
          arrows: 'to',
          width: 3.5, // Thicker structural lines
          font: {
            color: '#ffffff', // High contrast white text for the label
            size: 11,
            align: 'top',
            background: '#1a2035', // Solid dark box background behind the text label
            strokeWidth: 0 // Removes blurry borders
          },
          color: {
            color: '#7dd3fc', // High contrast bright blue/cyan lines
            highlight: '#69f0ae',
            hover: '#69f0ae'
          },
          smooth: {
            type: 'cubicBezier',
            roundness: 0.5
          }
        };
      });

      const graphData = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
      };

      const options = {
        physics: {
          stabilization: true,
          barnesHut: {
            gravitationalConstant: -2000,
            centralGravity: 0.3,
            springLength: 150,
            springConstant: 0.04
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 100
        }
      };

      // Create interactive canvas object
      network = new vis.Network(networkDiv, graphData, options);
      
      // Make action tools visible once rendering finishes
      exportBar.style.display = 'flex';
    }

    // Function to grab Canvas and trigger browser download
    function downloadCanvas() {
      if (!network) return;
      
      // Force stabilization before drawing snapshot
      const canvas = networkDiv.getElementsByTagName('canvas')[0];
      if (!canvas) return;
      
      // Create temporary link element
      const link = document.createElement('a');
      link.download = `LectureLens_MindMap_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Function to handle browser layout formatting for printing
    function printMap() {
      window.print();
    }

    async function uploadLecture() {
      const file = fileInput.files[0];
      if (!file) {
        statusEl.textContent = 'Choose a file first.';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      submitBtn.disabled = true;
      statusEl.textContent = 'Uploading and processing...';
      networkDiv.innerHTML = "<div style='color: #7dd3fc; display: grid; place-items: center; height: 100%; font-size: 1.2rem; font-weight: 500;'>Rendering Mind Map Architecture... Please Wait.</div>";
      exportBar.style.display = 'none';

      try {
        const response = await fetch('/process-audio', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || 'Processing failed.');
        }
        statusEl.textContent = `Done. Title: ${data.lecture_title}`;
        
        // Render the node network
        renderMindMap(data);
        
      } catch (error) {
        statusEl.textContent = 'Error processing file.';
        networkDiv.innerHTML = `<div style='color: #ef4444; padding: 20px;'>Error: ${String(error.message || error)}</div>`;
      } finally {
        submitBtn.disabled = false;
      }
    }

    submitBtn.addEventListener('click', uploadLecture);
    dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.style.borderColor = 'rgba(105, 240, 174, 0.9)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'rgba(125, 211, 252, 0.34)'; });
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.style.borderColor = 'rgba(125, 211, 252, 0.34)';
      if (event.dataTransfer.files.length > 0) {
        fileInput.files = event.dataTransfer.files;
        statusEl.textContent = `Selected ${event.dataTransfer.files[0].name}`;
      }
    });
  </script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def home():
    return HOME_PAGE


@app.post("/process-audio", response_model=LectureMindMap)
async def process_audio(file: UploadFile = File(...)):
    temp_file_path = f"temp_{file.filename}"

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print(f"[API] Processing audio file: {file.filename}...")
        mind_map_data = run_pipeline(temp_file_path)

        if not mind_map_data:
            raise HTTPException(status_code=400, detail="The pipeline returned no mind map data.")

        return mind_map_data

    except Exception as e:
        print(f"[API ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)