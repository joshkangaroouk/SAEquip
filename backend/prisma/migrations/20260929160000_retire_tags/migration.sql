-- DropForeignKey
ALTER TABLE "ProductTag" DROP CONSTRAINT "ProductTag_hubProductId_fkey";

-- DropForeignKey
ALTER TABLE "ProductTag" DROP CONSTRAINT "ProductTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_groupId_fkey";

-- DropTable
DROP TABLE "ProductTag";

-- DropTable
DROP TABLE "Tag";

-- DropTable
DROP TABLE "TagGroup";

