// Offline name dictionary. Not exhaustive by design: it seeds detection, and
// every name found (by dictionary, context cue, or the optional AI model) is
// then propagated to all its other mentions in the text.

const FIRST = `
aarav aarush aarya aayush abhay abhijeet abhinav abhishek aditi aditya advait agastya ahaan
aishwarya ajay ajit akash akhil akshay akshara alok aman amar amisha amit amita amol amrita
amruta anaya anand ananya anika anil anirudh anish anita anjali ankit ankita anmol anoop
anshul anuj anupam anuradha anushka aparna archana arjun arnav arpit arun aruna arvind asha
ashish ashok ashwin atharv atul avani avinash ayaan ayesha ayush bhavana bhavesh bhavya
bharat chaitanya chandan chetan chirag darshan deepa deepak deepika devansh devika
dhanush dhruv dinesh disha divya diya ganesh gaurav gautam geeta girish gita gopal govind
gunjan gurpreet harsh harsha harshit hemant himani hitesh ira isha ishaan ishita jagdish
jai jaya jayant jatin jyoti kabir kajal kalpana kamal kanika karan kartik kavita kavya
keshav kiran kirti krish krishna kriti kunal lakshmi lalit lata madhav madhu madhuri mahesh
manav manish manisha manoj meena meera megha mehul mihir mohan mohit mukesh nandini naveen
navya neel neha nikhil nikita nilesh nisha nishant nitin nitya om pallavi pankaj parth
pooja prabhat pradeep prakash pranav prasad prashant pratik pratiksha praveen preeti prerna
priya priyanka puja rachna radha radhika raghav rahul raj rajat rajeev rajesh rajiv raju
rakesh ramesh rani ravi reena rekha reyansh rhea riddhi rishi ritika rohan rohit ronak
roshni ruchi rupal rutuja saanvi sachin sagar sahil sai sakshi sameer samir sandeep sandhya
sanjana sanjay sanket santosh sara sarika saurabh seema shalini shankar sharad shikha
shilpa shivam shiv shivani shraddha shreya shruti shubham siddharth simran sneha sonal
sonali sonia srinivas sruthi subhash sudha sudhir sumit sunil sunita suraj suresh swati
tanmay tanvi tanya tarun tejas trisha tushar uday udit uma umesh urvashi usha vaibhav vandana
varun vasudha ved vedant vidya vijay vikas vikram vinay vineet vinod vipul vishal vivek
yash yashika yogesh yuvraj zoya ali faiz farhan fatima imran irfan javed junaid kabeer
mohammed mohammad mohd nadia nasir rehan rizwan salman sana shahid shahrukh sohail tariq
yusuf zainab zaid arpita debashish indrani sourav subhajit tanushree abhirup anirban
arijit dipankar koushik moumita prosenjit sayan soumya sudipta suvendu biswajit karthik
karthika lakshmanan murali muthu prabhu ramya saravanan senthil shanthi sivakumar
subramanian vignesh balaji venkatesh srikanth sridhar gopinath harini janani keerthana
nithya pavithra revathi sowmya divakar mani ravindra jaspreet harpreet manpreet navjot
simranjeet gurmeet baljeet kuldeep hardeep amandeep
john james michael david william richard joseph thomas christopher daniel matthew anthony
andrew joshua kevin brian steven timothy jason ryan jacob nicholas eric jonathan justin
brandon benjamin samuel alexander patrick nathan tyler aaron adam ethan noah liam oliver
lucas elijah logan mason sophia emma olivia ava isabella mia charlotte amelia emily
elizabeth sarah jessica jennifer ashley amanda stephanie nicole rachel rebecca laura
hannah natalie samantha katherine lauren megan alice sofia chloe maria anna priscilla
`

const LAST = `
sharma verma gupta singh kumar patel shah mehta joshi desai iyer iyengar nair menon pillai
reddy rao naidu chowdhury choudhary chaudhary banerjee chatterjee mukherjee bhattacharya
ganguly ghosh bose das dutta sen roy saha sinha mishra pandey tiwari trivedi dwivedi
chaturvedi shukla dubey yadav jain agarwal aggarwal agrawal bansal goel garg mittal
khandelwal maheshwari malhotra kapoor khanna chopra arora bhatia sethi kohli ahuja anand
bajaj batra chawla dhawan gill grewal sandhu sidhu dhillon randhawa bhatt kulkarni
deshpande deshmukh patil pawar jadhav shinde gaikwad chavan kadam more naik sawant thakur
rane gokhale apte bhosale mahajan nambiar kurup varma krishnan subramaniam venkatesan
raghavan srinivasan ramanathan natarajan swaminathan narayanan gopalan balasubramanian
hegde shetty kamath pai bhat acharya gowda murthy prasad hussain khan ansari qureshi
sheikh siddiqui syed rizvi mirza pathan fernandes dsouza pereira rodrigues gomes lobo
mathew thomas george kurian varghese chandra mohan saxena srivastava rastogi kaul raina
dhar wadhwa oberoi bedi tandon kakkar talwar nanda rathore rajput chauhan solanki parmar
vaghela zala makwana modi thakkar vora parekh sanghvi doshi kothari lodha bhandari
smith johnson williams brown jones miller davis wilson anderson taylor moore jackson
martin lee thompson white harris clark lewis robinson walker young allen king wright
scott hill green adams baker nelson carter mitchell roberts turner phillips campbell
parker evans edwards collins stewart morris murphy cook rogers morgan cooper peterson
`

const toSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean))

export const FIRST_NAMES = toSet(FIRST)
export const LAST_NAMES = toSet(LAST)

/** Capitalised words that are never names on their own. */
export const NOT_NAMES = toSet(`
the a an i im i'm my me we our you your he she they it this that these those and or but
if then so to of in on at by for with from as is are was were be been am not no yes hi
hello hey dear regards thanks thank sincerely best warm kind yours cheers please sir madam
mr mrs ms dr shri smt sri kumari monday tuesday wednesday thursday friday saturday sunday
january february march april may june july august september october november december
india indian hindi english bank road street nagar colony sector lane city state district
pin pincode address name father mother wife son daughter husband date birth dob aadhaar
pan card account number mobile phone email id no ltd pvt limited private company college
university school hospital hotel team manager hr sales support customer service
government ministry department office police station court the
hiring recruiter concerned whom all everyone friend friends colleagues user admin
google amazon microsoft apple flipkart paytm phonepe zomato swiggy uber ola jio airtel
vodafone sbi hdfc icici axis kotak whatsapp instagram facebook meta twitter linkedin
youtube netflix chatgpt openai claude gemini copilot github slack discord zoom teams
sample specimen form verification tenant landlord owner police
`)

export function isFirstName(w: string) {
  return FIRST_NAMES.has(w.toLowerCase())
}
export function isLastName(w: string) {
  return LAST_NAMES.has(w.toLowerCase())
}
