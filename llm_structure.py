import os
from typing import List, Literal
from pydantic import BaseModel, Field
import instructor
from groq import Groq
from dotenv import load_dotenv
load_dotenv()
# 1. Define the structure for a single Node
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
    summary: str = Field(description="1-2 highly descriptive sentences explaining the concept clearly")

# 2. Define the structure for a single Edge 
class MindMapEdge(BaseModel):
    id: str = Field(description="Unique identifier like edge_1, edge_2")
    source: str = Field(description="The parent node id where the arrow starts")
    target: str = Field(description="The child node id where the arrow points")
    label: str = Field(description="Lowercase operational phrase like 'requires' or 'leads to'")

# 3. Define the final overall response structure
class LectureMindMap(BaseModel):
    lecture_title: str = Field(description="The most suitable title of the processed lecture")
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]

def transform_transcript_to_mindmap(raw_transcript: str) -> LectureMindMap:
    # Replace os.environ.get("OPENAI_API_KEY") with os.environ.get("GROQ_API_KEY")
    client = instructor.from_groq(Groq(api_key=os.environ.get("GROQ_API_KEY")))
    
    system_prompt = (
        "You are an expert educational content architect specialized in cognitive accessibility. "
        "Your job is to transform raw, messy spoken audio transcripts into a clean, highly structured "
        "hierarchical mind map JSON object for hearing impaired but visually strong learners. "
        "Core Processing Rules:"
        "1. NOISE FILTERING: Strip out filler words, stumbles, and administrative remarks."
        "2. TANGENTS: Capture relevant tangents as a single node typed 'note' or 'insight' linked via a 'tangent' edge."
        "3. DEDUPICATING: Do not create duplicate nodes for the same topic. Synthesize returning info into the existing node."
        "4. MINIMUM NODES: Extract at least 3 to 7 distinct nodes for a standard lecture segment."
        "5. SUMMARY LIMIT: The summary field must not exceed 2-3 sentences."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        response_model=LectureMindMap,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"### TRANSCRIPT START ###\n{raw_transcript}\n### TRANSCRIPT END ###"}
        ],
    )

    return response


# 4. Study questions, generated once per lecture from its already-structured mind map
# (not the raw transcript, which isn't persisted after processing).
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
    # A tiny fake transcript string for debugging
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
        # Run your function
        result = transform_transcript_to_mindmap(sample_transcript)
        
        # Print the structured result as a formatted JSON string
        print(result.model_dump_json(indent=2))
        print("\nSuccess! The output perfectly matches your schema data contract.")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Make sure you have set your OPENAI_API_KEY environment variable!")