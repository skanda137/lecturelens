import os
from typing import List, Literal
from pydantic import BaseModel, Field
import instructor
from groq import Groq
from dotenv import load_dotenv
load_dotenv()
class MindMapNode(BaseModel):
    id: str = Field(description="Unique identifier like node_1, node_2")
    label: str = Field(description="Short text, 2-5 words maximizing structural clarity")
    type: Literal["main_topic", "sub_topic", "note", "insight"] = Field(
        description="The category classification of the concept node"
    )
    color_theme: str = Field(
        description="A Tailwind CSS color class suitable for this node type, e.g., 'bg-blue-500' for main, 'bg-emerald-500' for insights"
    )
    hierarchy_level: int = Field(
        description="The depth level in the mind map hierarchy (0 for main_topic, 1 for sub_topic, 2 for details)"
    )
    summary: str = Field(
        min_length=40,
        description=(
            "A thorough, fully self-contained explanation of this single concept — typically 4-8 "
            "sentences for a real concept or mechanism (fewer, e.g. 2-3, is fine ONLY for a genuinely "
            "trivial node like a single named part with nothing more to say). The reader cannot re-listen "
            "to the audio and cannot ask a follow-up question, so this summary is their only source of "
            "truth. Where there is enough source material, cover: (1) what the concept is, in plain terms, "
            "(2) how or why it works / why it matters, (3) how it connects to neighboring concepts in the "
            "map, and (4) a concrete example, analogy, or consequence drawn from the transcript. Define "
            "jargon the first time it appears. Every sentence must add genuinely new information — never "
            "pad length by restating the same point in different words."
        )
    )

class MindMapEdge(BaseModel):
    id: str = Field(description="Unique identifier like edge_1, edge_2")
    source: str = Field(description="The parent node id where the arrow starts")
    target: str = Field(description="The child node id where the arrow points")
    label: str = Field(description="Lowercase operational phrase like 'requires' or 'leads to'")

class LectureMindMap(BaseModel):
    lecture_title: str = Field(description="The most suitable title of the processed lecture")
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]

def transform_transcript_to_mindmap(raw_transcript: str) -> LectureMindMap:
    client = instructor.from_groq(Groq(api_key=os.environ.get("GROQ_API_KEY")))
    
    system_prompt = (
        "You are an expert educational content architect specialized in cognitive accessibility. "
        "Your job is to transform raw, messy spoken audio transcripts into a clean, highly structured "
        "hierarchical mind map JSON object for a Deaf or hard-of-hearing student. "
        "\n\n"
        "CRITICAL CONTEXT: This student is learning ENTIRELY through the mind map you produce. They "
        "cannot re-listen to the audio, cannot ask the lecturer a follow-up question, and have no other "
        "source of clarification. If a concept is missing, too shallow, or ambiguous in your output, it "
        "is permanently lost to this student. Every node must stand on its own and leave no room for doubt.\n\n"
        "Core Processing Rules:"
        "1. NOISE FILTERING: Strip out filler words, stumbles, and administrative remarks."
        "2. FULL COVERAGE, HIGH GRANULARITY: Extract EVERY distinct topic, subtopic, mechanism, named "
        "component, definition, process step, and example mentioned in the transcript as its OWN node. "
        "Do not compress multiple distinct ideas into a single node just to keep the node count low. "
        "Prefer many small, precise nodes over a few broad ones — a rich lecture segment should typically "
        "produce 15-40+ nodes (more for longer or denser transcripts), not the 3-7 of a shallow outline. "
        "Sparse coverage is a failure condition. IMPORTANT: node count and summary depth are BOTH required "
        "— do not sacrifice one for the other. Do not respond with only a handful of heavily-padded nodes "
        "when the transcript clearly contains many distinct ideas; split them out instead."
        "3. DEEP, SELF-CONTAINED SUMMARIES: Every node's summary must be a dense, substantive explanation "
        "(see the summary field's own instructions) — never a 1-2 sentence blurb, and never padded with "
        "repetitive restatements just to look longer. Write as if explaining to someone who will never hear "
        "the original audio and cannot ask you anything else."
        "4. CLARIFYING NOTES FOR DOUBT: Whenever the transcript glosses over something quickly, uses "
        "similar-sounding or easily-confused terms, or describes a multi-step cause-and-effect the student "
        "could easily misread, add a dedicated node typed 'note' that explicitly resolves the ambiguity or "
        "common misconception, linked to the relevant concept via a 'clarifies' edge. Do not let potential "
        "confusion pass through unaddressed."
        "5. TANGENTS: Capture relevant tangents as a node typed 'note' or 'insight' linked via a 'tangent' edge."
        "6. DEDUPLICATING: Do not create duplicate nodes for the same topic. Synthesize returning info into "
        "the existing node's summary instead of creating a near-duplicate."
        "\n\n"
        "EXAMPLE of a good summary for a substantive concept node labeled 'Coolant Thermostat' — a summary "
        "this shallow is UNACCEPTABLE: \"The thermostat regulates coolant temperature.\" Instead: \"The "
        "thermostat is a valve that controls how much coolant flows back through the engine versus out to "
        "the radiator. When the engine is cold, it stays closed so coolant recirculates locally and the "
        "engine warms up faster, which matters because a cold engine burns fuel less efficiently and wears "
        "parts out faster. Once coolant reaches a target temperature, the thermostat opens and redirects "
        "flow to the radiator, where airflow pulls heat out of the liquid before it returns to the engine — "
        "the same loop described in the Cooling System node. If a thermostat fails stuck closed the engine "
        "overheats; if it fails stuck open the engine runs cold and less efficiently. A common point of "
        "confusion: 'thermostat' here means a temperature-triggered valve, not a household thermostat.\" "
        "Notice every sentence adds a new fact — mechanism, reasoning, connection, or failure case — nothing "
        "is restated. Contrast that with a BAD, padded version for a simple node labeled 'Air Filter': "
        "\"The air filter filters the air. It is an important part of the engine. The air filter's job is to "
        "make sure the air is clean. This is a critical function for the engine's performance.\" — that is "
        "four sentences with only one actual fact, repeated four ways. For a simple node like this, two "
        "dense sentences (what it does + why it matters, e.g. mentioning what happens if it clogs) beat four "
        "padded ones. Match summary length to how much the concept actually contains, but never let that be "
        "an excuse to cut the total node count instead."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_model=LectureMindMap,
        max_tokens=8000,
        max_retries=3,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"### TRANSCRIPT START ###\n{raw_transcript}\n### TRANSCRIPT END ###"}
        ],
    )

    return response


class StudyQuestion(BaseModel):
    question: str = Field(description="A specific study question testing real understanding of a concept from the lecture")
    answer: str = Field(description="A concise, correct answer to the question, 1-3 sentences")


class StudyQuestionSet(BaseModel):
    questions: List[StudyQuestion]


def generate_study_questions(lecture_title: str, nodes: list) -> StudyQuestionSet:
    client = instructor.from_groq(Groq(api_key=os.environ.get("GROQ_API_KEY")))

    outline = "\n".join(f"- {n['label']} ({n['type']}): {n['summary']}" for n in nodes)

    system_prompt = (
        "You are an expert educator writing a short study quiz from a lecture's structured outline. "
        "Write clear, specific questions that test real understanding of the concepts below — never "
        "generic or templated questions like 'What is the purpose of X?'. Cover a spread of the outline "
        "rather than repeating one topic. Provide a concise, correct answer for each question."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_model=StudyQuestionSet,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Lecture: {lecture_title}\n\nOutline:\n{outline}\n\nGenerate 5-8 study questions with answers.",
            },
        ],
    )

    return response

if __name__ == "__main__":
    sample_transcript = (
        """i'm jake o'neil creator of animagraphs
and this is how a car engine works
let's start at a single piston
the powerhouse of the engine
and work our way outwards
4 Stroke Cycle
the four-stroke cycle
when a piston travels to the end of its
range
whether up or down
that's a stroke
car engines use a four-stroke cycle
and it goes like this first intake
the piston descends
sucking an air fuel mixture into the
cylinder
through the intake port
with both intake valves open
next
compression
with all valves closed the piston comes
back up
compressing the fuel and air mixture for
more powerful combustion
then the power stroke
an electrical spark ignites the
compressed fuel and air mixture
and the resulting combustion forces the
piston to the bottom of the cylinder
again
a connecting rod transfers this power to
the crankshaft
finally exhaust
the piston comes back up
pushing the spent mixture out through
open exhaust valves and the exhaust port
Firing Order
connecting multiple pistons
for smooth power delivery pistons take
turns firing
the firing order for this engine
is one
three
four two
Camshaft / Timing Belt
camshafts with specially shaped cams
push spring-loaded valves open in turn
cam gears and a timing belt or chain
links everything to the crankshaft
and it all spins together
[Music]
Crankshaft
the crankshaft translates piston power
out of the engine
it has counterweights to balance against
the pistons for perfectly smooth
revolutions
is what rpm means
we're counting the number of full
crankshaft revolutions per minute
Block / Heads
the engine block holds the crankshaft
and cylinders
and the cylinder head holds valves ports
cams etc
a geared flywheel sits at one side of
the crankshaft
for connection to a transmission
it's also where the starter connects to
the system
V6 / V8
this engine has four cylinders arranged
in a single row
but there are many other possible
configurations
like six cylinders with three on each
side
angled in a v shape
or eight
despite different design goals the basic
engine parts are all there
now let's look at other systems that
support this combustion process
Air Intake
air intake
air comes in through the air filter
and then into the intake manifold where
it mixes with fuel before being sucked
into individual cylinders
through intake ports
Fuel
fuel
the fuel pump carries gas from the tank
through a fuel filter
to the engine
where fuel injectors emit a precisely
timed spray of gas into the intake port
Cooling
cooling
engines get very hot during operation
and require a cooling system
coolant channels around the cylinders
and through the cylinder heads carry a
special liquid called antifreeze
to keep temperatures within safe
operating range
it's called antifreeze because it won't
freeze in icy weather
after cooling hot engine parts coolant
circulates through the radiator
the radiator has a network of small
tubes and fins
coolant passes through these channels
while air pulled in by the radiator fan
blows by the tubes cooling the hot
liquid for recirculation
a water pump keeps the coolant system
flowing and properly pressurized
the thermostat regulates coolant
temperature by either routing coolant
back through the engine
or to the radiator for further cooling
Electrical
electrical
the spark plug delivers the electrical
spark that ignites the fuel air mixture
for combustion the metal core is
insulated from the outer metal casing
with porcelain
the spark jumps between these conductive
surfaces
a coil pack delivers electrical current
to the spark plugs
as directed by the ecm or engine control
module
the ecm is a computer that directs many
core engine functions like spark timing
valve open and closed timing
air to fuel ratio etc
the alternator works like a power
generator
converting the engine's mechanical
energy into electricity to charge the
battery or run other electrical systems
while the engine is running
the battery provides power to the
starter for engine start
[Music]
Oil
oil
motor oil is used to lubricate clean
prevent corrosion improve sealing
and cool the engine by carrying heat
away from moving parts
rings around the top of the piston head
keep oil out of the combustion process
while otherwise allowing the cylinder to
be lubricated
oil galleries are channels through the
engine block and cylinder head that
carry oil to various engine parts
oil flows through the engine and back to
the oil pan for recirculation
[Music]
oil rests in the oil pan when not in
circulation
the oil pump keeps oil properly
pressurized and flowing
and the oil filter keeps oil clean from
contaminants
Exhaust
exhaust
[Music]
the exhaust manifold collects gases from
multiple cylinders into one pipe
exhaust flows through the catalytic
converter which captures toxic chemicals
in engine exhaust
and then out through a muffler that
reduces exhaust noise
Full Model
and finally
here's the full functioning engine with
all the basic systems we've discussed
you"""
    )
    
    print("Testing LLM Structure function...")
    try:
        result = transform_transcript_to_mindmap(sample_transcript)
        
        print(result.model_dump_json(indent=2))
        print("\nSuccess! The output perfectly matches your schema data contract.")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Make sure you have set your OPENAI_API_KEY environment variable!")