# Use Case: Ranking the most popular car brands in the world.

```json
{ 
	name: 'Porsche', 
	timestamp: 1604325221 
}
```

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

Deleting ingress if its there
```bash
kubectl delete ingress --all
```

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev` or with a wsl distribution use `skaffold dev --default-repo=192.168.49.2:49154`
Adding a Split Terminal to forward the port:
```bash
kubectl port-forward deployment/popular-slides 3000:3000
```

## Watch
To see the results in Browser type in `localhost:3000`
