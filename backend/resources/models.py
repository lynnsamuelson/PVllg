from django.db import models


class Resource(models.Model):
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    summary = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title
