Objective

* We need to create charts to visualize the impact of automated onboarding using component onboarding skills, more details can be found on https://github.com/opendatahub-io/aiops-infra/blob/main/docs/rfds/odh-component-onboarding/component-onboarding-skill.md 
* We also need to create a gitlab-ci pipeline which keeps pushing the data to data/ai-impact/ regularly using CRON schedule 

Ensure

* Make sure we are aligned with other charts on this app  
* Make sure we adopt the existing patterns for authentication, security, deployment and technical stack used in this application  
* Make sure to adopt the pattern of existing charts in this application

Data:

* We have a set of jira issues which are used as a single source of truth for each component onboarding for a particular feature  
* Feature can be found by running a jql using acli with following criteria:  
  * Project name is RHOAIENG  
  * Should have been cloned either from RHOAIENG-17225 or RHOAIENG-35683  
  * Should have a label “component-onboarding”  
  * If jira issue is Resolved or Closed  
* Each of these jira issues have  
  *  One or more RHAISTRAT feature jira linked   
  * A yaml attached with name “componentonboardingdetails.yaml” which has all the details about that component including productcontext  
* Component onboarding can be categorized as completed or in-progress based on various status values of jira issues  
* Make sure to have a fixture for demo run of the app

Charts

* These charts will be shown in the “Build & Release” section under the “AI Impact” section of the application  
* We need to create multiple possible charts to cover following features:  
  * Overall components onboarded or in-progress so far  
  * Components onboarded grouped on the linked feature  
  * A detailed table with all the details of each component onboarding done  
* You are free to devise more number of charts to show the impact with more KPIs in various ways, so feel free to innovate more such charts as needed

Data ingestion pipeline

* Make sure to have a dedicated folder in the project for all the files related to this pipeline  
* We need to create a gitlab-ci pipeline which will run externally based on a cron schedule  
* It will fetch all the jira issues for component onboarding along with all other relevant details  
* It will use backend APIs of the application to update the data in the data/ai-impact/ dir on the server to have the assessment of AI impact for the component onboarding skills we worked on  
  * Make sure to have a clean update of the data each time, and should not result into any duplicate or missing data  
* Use the existing pattern of how AI impact assessment data is being stored