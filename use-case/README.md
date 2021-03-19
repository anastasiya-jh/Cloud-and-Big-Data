# Use Case: Ranking the most popular car brands in the world.

The main goal of this application is to build a data product in which the use of the data, generates the data needed to improve the product itself. In this application the collected data is counted and sorted. On the landingpage all car companies are listed and can be clicked. If clicked you can gather more information about the chosen company.
It is also possible to generate up to 200 random car companies at once. Every five minutes a new Batch will be generated that holds the information of all visited car companies in that period of time. The output can be seen on the landingpage visualizing the top 5 list with the most viewed car brands. 

## Prerequisites

A running Strimzi.io Kafka operator

```bash
helm repo add strimzi http://strimzi.io/charts/
helm install my-kafka-operator strimzi/strimzi-kafka-operator
kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
```

A running Hadoop cluster with YARN (for checkpointing)

```bash
helm repo add stable https://charts.helm.sh/stable
helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
```

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev` or with a wsl distribution use `skaffold dev --default-repo=[minikube-ip]:[port]`

Adding a Split Terminal to forward the port if started with a wsl distribution:
```bash
kubectl port-forward deployment/popular-slides 3000:3000
```

## Watch
To see the results in Browser type in `localhost:3000`

# Lambda architecture and processing of information:
The client/user accesses the webserver through the load balancer.
The webserver receives the client's messages and then transfers them to the big data messaging framework in the backend.
The processing of the data is found in the backend. From all the collected data, new data will be generated to improve the product which is the website top 5 car companies.
The calculations and processing done in the big data layer, will later be fed into a database server. 
When the webserver receives a request, it will first look in the cache server and this is for two reasons: 
- First, to reduce the load on the database.
- Second it is a faster process as the data is already available and there is no need to search for it in the database again.

Whenever a car company is clicked, a json file is generated. This data is sent to kafka for processing. The output of kafka is later on saved in the database MySQL. The webserver fetches the data from the cache or the database.

# Main components:
![image](https://user-images.githubusercontent.com/47325924/111697462-e4e83700-8835-11eb-9b9d-e8fddde99744.png)

- **Load balancer:** based on kubernetes to ditribute the client requests across the webservers.
- **Web server:** a simple node.js app instance.
- **Cache servers:** memcached as a memory and data caching system.
- **Database server:** MySQL database to store the data.
- **Data lake:** HDFS is used as the storage system to accommodate the big data in all its types.
- **Big data messaging:** Kafka for stream handling and transporting the data from the data sources to a storage system.
- **Big data processing:** Spark is running on a hadoop cluster and is reponsible for processing the data.

# Applications:

## Node.js:
The connection to the kafka cluster is created in the node.js application. The kafka cluster is created with one ID, brocker and producer to send the data.
--> the application is packaged using docker

## Spark app:
This app analyses the data read from the kafka cluster.
Here the messages are deconstructed and aggredated: data is converted from binary to json data.
The data is later shown on the console
After every streaming batch actualisation, the data is saved in the MySQL database pro spark host / partition.
This means : data will be saved in the database on every new batch.
==> the application is packaged using docker

# MySQL configmap (schema / inserts):
The data used for this application are stored in a kubernetes ConfigMap.
The database consists of 2 tables:
- **Companies:** table that contains the information needed of every car company such as name, origin, segment and a url of the company's logo.
- **Ranking:** table that contains the name of the company and the corresponding count number (number of views)
	
## Contributors
@sabrine-gamdou
@anastasiya-jh
