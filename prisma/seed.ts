const { PrismaClient } = require("../node_modules/@prisma/client/.prisma/client") as {
  PrismaClient: new () => any;
};

const prisma = new PrismaClient();

async function main() {
  const tags = ["kubernetes", "terraform", "docker", "ci-cd", "aws", "observability"];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag },
      update: {},
      create: { name: tag, followerCount: Math.floor(Math.random() * 500) + 50 },
    });
  }

  await prisma.tool.upsert({
    where: { name: "Terraform" },
    update: {},
    create: {
      name: "Terraform",
      description: "Infrastructure as Code provisioning tool.",
      category: "Infrastructure as Code",
      githubRepoUrl: "https://github.com/hashicorp/terraform",
      websiteUrl: "https://www.terraform.io",
      docsUrl: "https://developer.hashicorp.com/terraform/docs",
      popularityScore: 98,
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
