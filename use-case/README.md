# Use Case: Ranking the most popular car brands in the world.

The main goal of this application is to build a data product in which the use of the data, generates the data needed to improve the product itself. In this application the collected data is counted and sorted. On the landingpage all car companies are listed and can be clicked. If clicked you can gather more information about the chosen company.
It is also possible to generate up to 200 random car companies at once. Every five minutes a new Batch will be generated that holds the information of all visited car companies in that period of time. The output can be seen on the landingpage visualizing the top 5 list with the most viewed car brands. 

## Prerequisites

Deleting all current helm services
```bash
helm delete my-hadoop-cluster 
helm delete my-kafka-operator 
```

Clean up all services from already deployed applications
```bash
kubectl delete service --all
kubectl delete replicaset --all
kubectl delete deployment --all
kubectl delete statefulset --all
```

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

## Contributors
@sabrine-gamdou
@anastasiya-jh

