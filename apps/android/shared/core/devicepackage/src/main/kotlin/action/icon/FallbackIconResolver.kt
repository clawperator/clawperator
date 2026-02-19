package action.icon

import android.graphics.drawable.Drawable
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

interface FallbackIconResolver {
    fun getDrawable(): LiveData<Drawable>

    fun getIconHighlightColor(): LiveData<Int>
}

class FallbackIconResolverStub : FallbackIconResolver {
    override fun getIconHighlightColor() = MutableLiveData<Int>().apply { postValue(0) }

    override fun getDrawable() = MutableLiveData<Drawable>().apply { postValue(null) }
}
